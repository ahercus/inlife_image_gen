// api/generate.js
export const config = {
  runtime: 'edge',
};

const generatePrompts = async (prompt, model, start, end) => {
  try {
    const systemPrompt = `You are a helpful assistant that generates optimized image prompts for Flux based on the user's vision. Generate prompts for image numbers ${start} through ${end} only.

Return a JSON array containing objects with exactly these fields:
- imageNumber (number)
- imagePrompt (string)
- imageRatio (string)

Follow these specifications exactly:
Portrait Images (#1-5): ratio "3:4"
Establishing Shots (#6-9): ratio "16:9"
Editorial Vignettes (#10-19): ratio "4:3" for #10 & #19, "3:4" for #11-18
Close-Up Shots (#20-31): ratio "1:1"
Macro Shots (#32-35): ratio "1:1"
Contextual Shots (#36-49): ratio "4:3"

Each imagePrompt must include in this order:
1. Shot type
2. Subject ("Me, a woman/man" for #1-5)
3. Environment
4. Key visual elements
5. Mood/emotion
6. Style ("iPhone")
7. Lighting and color tones

Keep prompts under 75 tokens. No other humans besides the subject.`;

    console.log('Sending request to OpenAI...');
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
    console.log('OpenAI response:', response);

    const parsedContent = JSON.parse(response.choices[0].message.content);
    console.log('Parsed content:', parsedContent);

    // Handle both possible response formats
    let prompts;
    if (Array.isArray(parsedContent)) {
      prompts = parsedContent;
    } else if (parsedContent.data && Array.isArray(parsedContent.data)) {
      prompts = parsedContent.data;
    } else {
      throw new Error('Invalid response structure from AI model');
    }

    // Validate the prompts
    if (!prompts.every(prompt => 
      prompt.imageNumber && 
      prompt.imagePrompt && 
      prompt.imageRatio)) {
      throw new Error('Invalid prompt format in AI response');
    }

    return prompts;

  } catch (error) {
    console.error("Error in generatePrompts:", error);
    return { message: error.message || "An error occurred while generating prompts." };
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
    const body = await req.json();
    console.log('Received request body:', body);

    if (!body.prompt) {
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

    // Generate prompts sequentially for better error handling
    console.log('Generating first half of prompts...');
    const firstHalf = await generatePrompts(body.prompt, "gpt-4", 1, 24);
    if (firstHalf.message) {
      throw new Error(firstHalf.message);
    }

    console.log('Generating second half of prompts...');
    const secondHalf = await generatePrompts(body.prompt, "gpt-4", 25, 49);
    if (secondHalf.message) {
      throw new Error(secondHalf.message);
    }

    const combinedPrompts = [...firstHalf, ...secondHalf];
    console.log('Successfully combined prompts:', combinedPrompts.length);

    return new Response(JSON.stringify(combinedPrompts), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Error in API handler:", error);
    return new Response(
      JSON.stringify({ message: error.message || 'Internal server error.' }), 
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}