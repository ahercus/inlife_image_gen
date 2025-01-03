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
            content: `You are a helpful assistant that generates optimized image prompts for Flux based on the user's vision...`  // Your existing system prompt here
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
    const [firstHalfPrompts, secondHalfPrompts] = await Promise.all([
      generatePrompts(prompt, "gpt-4o", 1, 24),
      generatePrompts(prompt, "gpt-4o", 25, 49),
    ]);

    if (firstHalfPrompts.message || secondHalfPrompts.message) {
      return new Response(JSON.stringify({ message: firstHalfPrompts.message || secondHalfPrompts.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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