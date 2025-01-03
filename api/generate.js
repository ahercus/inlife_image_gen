// api/generate.js
export const config = {
  runtime: 'edge',
};

const generatePrompts = async (prompt, model, start, end) => {
  try {
    const systemPrompt = `You are a helpful assistant that generates optimized image prompts for Flux based on the user's vision. Your goal is to create image prompts that align with the user's aspirations and maximize visual impact while following these guidelines:

    You are responsible for image numbers ${start} to ${end} only.

    Image Categories:
    - Portrait Images (#1-5): 3:4 ratio, featuring "Me, a woman/man"
    - Establishing Shots (#6-9): 16:9 ratio
    - Editorial Vignettes (#10 & #19): 4:3 ratio
    - Editorial Vignettes (#11-18): 3:4 ratio
    - Close-Up Shots (#20-31): 1:1 ratio
    - Macro Shots (#32-35): 1:1 ratio
    - Contextual Shots (#36-49): 4:3 ratio

    Each prompt must include:
    - Shot type
    - Aspect ratio
    - Subject ("Me, a woman/man" for #1-5)
    - Imagery details
    - Environment
    - Mood/emotion
    - Style ("iPhone")
    - Color and ambiance

    Format prompts as short phrases separated by commas.
    Maintain consistent style across all prompts.
    No discernible humans except the subject.
    Each prompt should be under 75 tokens.

    Return a JSON array of objects with:
    {
      "imageNumber": (number),
      "imagePrompt": (string),
      "imageRatio": (string e.g. "3:4")
    }`;

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
            content: systemPrompt
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!completion.ok) {
      const errorText = await completion.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const response = await completion.json();
    return JSON.parse(response.choices[0].message.content);

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

  try {
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

    // Generate both halves of the prompts in parallel
    const [firstHalfPrompts, secondHalfPrompts] = await Promise.all([
      generatePrompts(prompt, "gpt-4o", 1, 24),
      generatePrompts(prompt, "gpt-4o", 25, 49),
    ]);

    // Check for error messages from either half
    if (firstHalfPrompts.message || secondHalfPrompts.message) {
      return new Response(
        JSON.stringify({ message: firstHalfPrompts.message || secondHalfPrompts.message }), 
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Combine results
    const combinedPrompts = [...firstHalfPrompts, ...secondHalfPrompts];

    // Validate the combined results
    if (!Array.isArray(combinedPrompts) || combinedPrompts.length !== 49) {
      return new Response(
        JSON.stringify({ message: 'Invalid response format from AI model' }), 
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify(combinedPrompts), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Error during processing:", error);
    return new Response(
      JSON.stringify({ message: 'Internal server error.' }), 
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}