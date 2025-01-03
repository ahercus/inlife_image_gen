import { OpenAI } from "openai";

export const config = {
    runtime: 'edge',
};


const generatePrompts = async (prompt, model, start, end) => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const systemDirective = `
        You are a helpful assistant that generates optimized image prompts for Flux based on the user's vision. Your goal is to create image prompts that align with the user's aspirations and maximize visual impact while following these guidelines:

        ---

        ## Output Format

        - **All outputs must be returned as a single JSON array of JSON objects** if the vision can be fulfilled.
        - Each object in the array must have the following keys:
          - \`"imageNumber"\`: The sequential number of the image (${start} - ${end}).
          - \`"imagePrompt"\`: The text prompt describing the image.
          - \`"imageRatio"\`: The aspect ratio of the image, e.g., \`"3:4"\`.

        - **Do not use any Markdown code blocks or fences**. Do not include any text outside of the JSON structure in the final output. The final output must be strictly valid JSON.

        ---

        ## Vision Board Creation

        ### Total Prompts
         - **Image Numbers**: This job is to generate images for image numbers ${start} to ${end}.
         - You are responsible for ONLY ${end-start+1} prompts.

        - The prompts must be assigned image numbers as specified below.

        ### Image Categories and Details

        #### 1. Portrait Images Featuring the User (Images #1-5)

        - **Quantity**: 5 images
        - **Aspect Ratio**: \`"3:4"\`
        - **Description**:
          - Image #1: "Hero shot" with full context of the user's vision.
          - Images #2-3: Same environment as #1, subject performing simple actions (e.g., watering plants, painting, arranging flowers).
          - Images #4-5: Same environment as #1, subject in passive, reflective, or relaxed states.
          - Refer to the user as "Me, a woman" or "Me, a man."

        #### 2. Establishing Shots (Images #6-9)
        - **Quantity**: 4 images
        - **Aspect Ratio**: \`"16:9"\`
        - **Description**: Exterior/interior establishing shots relevant to the vision.

        #### 3. Editorial Vignettes (Images #10 & #19)
        - **Quantity**: 2 images
        - **Aspect Ratio**: \`"4:3"\`
        - **Description**: Editorial photography with rule of thirds, symmetry, and space.

        #### 4. Editorial Vignettes (Images #11-18)
        - **Quantity**: 8 images
        - **Aspect Ratio**: \`"3:4"\`
        - **Description**: Editorial photography focused on composition, symmetry, and visual interest.

        #### 5. Close-Up Shots (Images #20-31)
        - **Quantity**: 12 images
        - **Aspect Ratio**: \`"1:1"\`
        - **Description**: Close-ups highlighting textures and details significant to the vision.

        #### 6. Macro Shots (Images #32-35)
        - **Quantity**: 4 images
        - **Aspect Ratio**: \`"1:1"\`
        - **Description**: Extreme close-up (macro) shots focused on fine details.

        #### 7. Contextual Shots (Images #36-49)
        - **Quantity**: 14 images
        - **Aspect Ratio**: \`"4:3"\`
        - **Description**: Editorial photography providing context, interesting angles, and environmental details.

        ---

        ### Shot Types and Aspect Ratios

        - **1:1**: Close-up and macro shots.
        - **3:4**: Portrait images and some editorial vignettes.
        - **4:3**: Editorial vignettes and contextual shots.
        - **16:9**: Establishing shots.

        **Important Notes**:
        - **Do not include any discernible humans beyond the subject. Only hint at other humans if necessary.
        - **Adhere to Specified Ratios**: Use only the specified aspect ratios.
        - **Follow Image Numbers and Categories**: Assign image numbers as specified for each category.
        - **Maintain Visual Variety**: Ensure a balanced and visually interesting set of images.
        - **Prompt Length**: Each prompt should be concise and not exceed 75 tokens.
        - **Consistency**: Keep language, tone, and style consistent with Flux's requirements.

        ---

        ### Prompt Format and Content

        **Each Prompt Should EVERY ONE of these variables**:
        1. **Shot Type and Aspect Ratio**
        2. **Subject**: Explicitly mention the subject ("Me, a woman" or "Me, a man" for images #1-5, or describe the scene for others).
        3. **Imagery**: Briefly describe key visual elements.
        4. **Environment**: Provide contextual details.
        5. **Mood and Emotion**: Convey the feeling or atmosphere.
        6. **Style**: Specify \`"iPhone"\`.
        7. **Color and Ambiance**: Mention lighting and color tones.

        **Formatting Guidelines**:
        - Use short descriptive phrases separated by commas.
        - Avoid extraneous words.
        - Be consistent and clear.

        ---

        ## Edge Case Handling

        If the user's prompt is:
        - **Inappropriate Content**: Return \`{"message": "I'm sorry, but that prompt contains content that cannot be processed. Could you please provide a different prompt?"}\`
        - **Unrealistic/Nonsensical Content**: Return \`{"message": "The prompt seems to describe an impossible scene. Perhaps you could focus on a realistic setting that aligns with your vision?"}\`

        No additional commentary or formatting in these cases, just one JSON object with the \`"message"\` field.

        ---

        ## Final Output

        - Return exactly ${end-start+1} JSON objects in a single JSON array.

        No code fences, no Markdown, no extra text outside the JSON.
    `;


    try {
        const completion = await openai.chat.completions.create({
            model: model,
            messages: [
                {
                    role: "system",
                    content: systemDirective
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            response_format: { type: "json_object" },

        });

       const response = JSON.parse(completion.choices[0].message.content);

        return response;



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
              generatePrompts(prompt, "gpt-4o-2024-05-13", 1, 24),
              generatePrompts(prompt, "gpt-4o-2024-05-13", 25, 49),
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