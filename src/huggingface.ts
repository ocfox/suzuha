import {
  HfInference,
  TranslationArgs,
} from "https://esm.sh/@huggingface/inference@3.5.1";

const token = Deno.env.get("HUGGINGFACE_TOKEN") || "";

const hf = new HfInference(token);

export async function fluxImage(prompt: string) {
  try {
    const image = await hf.textToImage({
      endpointUrl:
        "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
      inputs: prompt,
    });
    return image;
  } catch (error) {
    console.error("Error in fluxImage:", error);
    throw new Error(
      `Failed to generate image: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

export async function StableDiffusionXLImg2Img(img: Blob, prompt: string) {
  try {
    const image = await hf.imageToImage({
      endpointUrl:
        "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-refiner-1.0",
      inputs: img,
      parameters: { prompt },
    });
    return image;
  } catch (error) {
    console.error("Error in StableDiffusionXLImg2Img:", error);
    throw new Error(
      `Failed to process image: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

export async function nllbTranslate(prompt: string) {
  try {
    const response = await hf.translation({
      endpointUrl:
        "https://api-inference.huggingface.co/models/facebook/nllb-200-distilled-600M",
      inputs: prompt,
      parameters: {
        src_lang: "eng_Latn",
        tgt_lang: "zho_Hans",
      },
    } as TranslationArgs);

    const answer =
      (response as unknown as { translation_text: string }).translation_text;

    return answer;
  } catch (error) {
    console.error("Error in nllbTranslate:", error);
    throw new Error(
      `Failed to translate: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}
