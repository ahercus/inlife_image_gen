// api/generate.js
export const config = {
  runtime: 'edge',
  regions: ['iad1'], // US East (N. Virginia) for faster response times
};

const API_TIMEOUT = 25000; // 25 second timeout

// Utility to handle API timeouts
const fetchWithTimeout = async (url, options, timeout) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
};

const generatePrompts = async (prompt, model, start, end) => {
  console.log(`🎯 Generating prompts ${start}-${end} with model ${model}`);
  try {
    const systemPrompt = `You are a helpful assistant that generates optimized image prompts for Flux based on the user's vision. Generate prompts for image numbers ${start} through ${end} only.

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

IMPORTANT: Respond ONLY with the specified JSON structure. Do not include any additional text or explanation.`;

    console.log('📤 Sending request to OpenAI API...');
    console.time('OpenAI API Request');
    
    const completion = await fetchWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 2000,
          response_format: {
            type: "json_schema",
            json_schema: {
              type: "object",
              required: ["prompts"],
              properties: {
                prompts: {
                  type: "array",
                  minItems: 1,
                  maxItems: 49,
                  items: {
                    type: "object",
                    required: ["imageNumber", "imagePrompt", "imageRatio"],
                    properties: {
                      imageNumber: {
                        type: "number",
                        minimum: 1,
                        maximum: 49
                      },
                      imagePrompt: {
                        type: "string",
                        minLength: 1
                      },
                      imageRatio: {
                        type: "string",
                        enum: ["1:1", "3:4", "4:3", "16:9"]
                      }
                    }
                  }
                }
              }
            }
          }
        })
      },
      API_TIMEOUT
    );

    console.timeEnd('OpenAI API Request');

    if (!completion.ok) {
      const errorData = await completion.json().catch(() => null);
      throw new Error(
        errorData?.error?.message || 
        `OpenAI API error: ${completion.status} ${completion.statusText}`
      );
    }

    const response = await completion.json();
    console.log('📥 OpenAI API Response:', response);

    // Check for refusal
    if (response.choices[0].message.refusal) {
      throw new Error(`Model refused to generate response: ${response.choices[0].message.refusal}`);
    }

    try {
      // Response is guaranteed to match our schema
      const promptsData = JSON.parse(response.choices[0].message.content);
      
      // Sort the prompts by image number
      const validatedPrompts = promptsData.prompts.sort((a, b) => a.imageNumber - b.imageNumber);
      
      return validatedPrompts;
    } catch (parseError) {
      console.error('Parse error:', parseError);
      console.error('Raw content:', response.choices[0].message.content);
      throw new Error('Failed to parse AI response');
    }

  } catch (error) {
    if (error.message.includes('timeout')) {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  }
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }), 
      { 
        status: 405,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }

  try {
    const body = await req.json();

    if (!body.prompt?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }), 
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Generate prompts in parallel for better performance
    const [firstHalf, secondHalf] = await Promise.all([
      generatePrompts(body.prompt, "gpt-4o", 1, 24),
      generatePrompts(body.prompt, "gpt-4o", 25, 49)
    ]);

    const combinedPrompts = [...firstHalf, ...secondHalf].sort(
      (a, b) => a.imageNumber - b.imageNumber
    );

    return new Response(
      JSON.stringify(combinedPrompts),
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }), 
      { 
        status: error.message.includes('timeout') ? 504 : 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}