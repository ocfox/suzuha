import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import { dict } from "./dict.ts";

export async function azureChat(prompt: string) {
  const client = ModelClient(
    "https://models.inference.ai.azure.com",
    new AzureKeyCredential(Deno.env.get("GITHUB_TOKEN") || "")
  );

  const response = await client.path("/chat/completions").post({
    body: {
      messages: [
        {
          role: "system",
          content: dict.zh.system,
        },
        { role: "user", content: prompt },
      ],
      model: "Meta-Llama-3.1-405B-Instruct",
      temperature: 0,
      max_tokens: 1024,
      top_p: 0.1,
    },
  });

  if (isUnexpected(response)) {
    return response.body.error.message;
  }

  const answer = response.body.choices[0].message.content;
  return answer ? answer : dict.zh.unknown;
}
