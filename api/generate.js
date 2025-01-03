// api/generate.js
export const config = {
  runtime: 'edge',
};

const generatePrompts = async (prompt, model, start, end) => {
  try {
    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant that generates optimized image prompts for Flux based on the user's vision. Your goal is to create image prompts that align with the user's aspirations and maximize visual impact while following these guidelines:

            You are responsible for image numbers ${start} to ${end} only.
            Each prompt must include: shot type, aspect ratio, subject, imagery, environment, mood/emotion, "iPhone" style, and color/ambiance.
            
            Image Categories:
            - Portrait Images (#1-5): 3:4 ratio, featuring "Me, a woman/man"
            - Establishing Shots (#6-9): 16:9 ratio
            - Editorial Vignettes (#10 & #19): 4:3 ratio
            - Editorial Vignettes (#11-18): 3:4 ratio
            - Close-Up Shots (#20-31): 1:1 ratio
            - Macro Shots (#32-35): 1:1 ratio
            - Contextual Shots (#36-49): 4:3 ratio
            
            Return a JSON array of objects with:
            - imageNumber: number
            - imagePrompt: string (max 75 tokens)
            - imageRatio: string (e.g. "3:4")
            
            Use iPhone style, no discernible humans except subject, keep prompts concise.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!completion.ok) {
      throw new Error(`OpenAI API error: ${await completion.text()}`);
    }

    const response = await completion.json();
    const parsedContent = JSON.parse(response.choices[0].message.content);
    
    // Check for error messages
    if (parsedContent.message) {
      return parsedContent;
    }

    return parsedContent;

  } catch (error) {
    console.error("Error generating prompts:", error);
    return { message: "An error occurred while generating prompts." };
  }
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { prompt } = await req.json();

  if (!prompt) {
    return new Response(JSON.stringify({ message: 'Prompt is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ message: 'OPENAI_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Run both halves of the prompt generation in parallel
    const [firstHalfPrompts, secondHalfPrompts] = await Promise.all([
      generatePrompts(prompt, "gpt-4-turbo-preview", 1, 24),
      generatePrompts(prompt, "gpt-4-turbo-preview", 25, 49),
    ]);

    // Check for error messages from either half
    if (firstHalfPrompts.message || secondHalfPrompts.message) {
      return new Response(JSON.stringify({ message: firstHalfPrompts.message || secondHalfPrompts.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Combine the results
    const combinedPrompts = [...firstHalfPrompts, ...secondHalfPrompts];

    return new Response(JSON.stringify(combinedPrompts), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Error during processing:", error);
    return new Response(JSON.stringify({ message: 'Internal server error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}