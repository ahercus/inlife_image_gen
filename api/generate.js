// api/generate.js
export const config = {
  runtime: 'edge',
  regions: ['iad1'],
};

const API_TIMEOUT = 25000;

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

const generatePrompts = async (prompt, start, end) => {
  console.log(`🎯 Generating prompts ${start}-${end}`);
  try {
    const systemPrompt = `You are a helpful assistant that generates optimized image prompts for Flux based on the user's vision. Generate prompts for image numbers ${start} through ${end} only.

Follow these specifications exactly:
Portrait Images (#1-5): ratio "3:4"
Establishing Shots (#6-9): ratio "16:9"
Editorial Vignettes (#10-19): ratio "4:3" for #10 & #19, "3:4" for #11-18
Close-Up Shots (#20-31): ratio "1:1"
Macro Shots (#32-35): ratio "1:1"
Contextual Shots (#36-49): ratio "4:3"

Each prompt must include:
1. Shot type and composition
2. Subject (use "Me, a woman/man" for portraits)
3. Environment details
4. Key visual elements
5. Mood and atmosphere
6. Style ("iPhone")
7. Lighting and color tones

Image numbers must be between 1 and 49.`;

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
          model: "gpt-4o-2024-08-06",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 2000,
          response_format: {
            type: "json_schema",
            json_schema: {
              strict: true,
                name: "FluxPromptsResponse",
                description: "A structured response containing image prompts for a vision board",
                type: "object",
                properties: {
                  prompts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        imageNumber: {
                          type: "integer"
                        },
                        imagePrompt: {
                          type: "string"
                        },
                        imageRatio: {
                          type: "string",
                          enum: ["1:1", "3:4", "4:3", "16:9"]
                        }
                      },
                      required: ["imageNumber", "imagePrompt", "imageRatio"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["prompts"],
                additionalProperties: false
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

    if (response.choices[0].message.refusal) {
      throw new Error(`Model refused to generate response: ${response.choices[0].message.refusal}`);
    }

    try {
      const content = response.choices[0].message.content;
      console.log('📄 Raw content:', content);
      
      const data = JSON.parse(content);
      const promptsData = data.prompts;
      return promptsData.sort((a, b) => a.imageNumber - b.imageNumber);
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
  console.log('📥 API Request received');
  
  if (req.method !== 'POST') {
    console.log('❌ Invalid method:', req.method);
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
    console.log('🔍 Parsing request body...');
    const body = await req.json();
    console.log('📝 Request body:', body);

    if (!body.prompt?.trim()) {
      console.log('❌ Empty prompt received');
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OpenAI API key not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }), 
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('⚡ Starting parallel prompt generation...');
    const [firstHalf, secondHalf] = await Promise.all([
      generatePrompts(body.prompt, 1, 24),
      generatePrompts(body.prompt, 25, 49)
    ]).catch(error => {
      console.error('❌ Error in prompt generation:', error);
      throw error;
    });

    console.log('✨ Combining prompt results...');
    const combinedPrompts = [...firstHalf, ...secondHalf].sort(
      (a, b) => a.imageNumber - b.imageNumber
    );

    console.log('✅ Successfully generated prompts:', combinedPrompts.length);
    return new Response(
      JSON.stringify(combinedPrompts),
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  } catch (error) {
    console.error('❌ API Error:', error);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? {
          stack: error.stack,
          name: error.name,
          message: error.message
        } : undefined
      }), 
      { 
        status: error.message.includes('timeout') ? 504 : 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}