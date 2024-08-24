import { HfInference } from "https://esm.sh/@huggingface/inference@2.8.0";

const token = Deno.env.get("HUGGINGFACE_TOKEN") || "";

const hf = new HfInference(token);

export async function fluxImage(prompt: string) {
  const image = await hf.textToImage({
    endpointUrl:
      "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
    inputs: prompt,
    model: "black-forest-labs/FLUX.1-schnell",
  });
  console.log(image);

  return image;
}
