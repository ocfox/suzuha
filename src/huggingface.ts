import { HfInference } from "https://esm.sh/@huggingface/inference@2.8.0";

const token = Deno.env.get("HUGGINGFACE_TOKEN") || "";

const hf = new HfInference(token);

export async function fluxImage(prompt: string) {
  const image = await hf.textToImage({
    endpointUrl:
      "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
    inputs: prompt,
  });

  return image;
}

export async function StableDiffusionXLImg2Img(img: Blob, prompt: string) {
  const image = await hf.imageToImage({
    endpointUrl:
      "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-refiner-1.0",
    inputs: img,
    parameters: { prompt },
  });

  return image;
}
