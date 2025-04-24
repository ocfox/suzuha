import { GoogleGenAI, Content } from "@google/genai";

const ai = new GoogleGenAI({
    apiKey: Deno.env.get("GOOGLE_API_KEY") || "",
});

export async function googleChatWrapper(id: number, prompt: string) {
    const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
            {
                role: "user",
                parts: [{ text: prompt }],
            },
        ],
    });
    const answer = response.text;
    if (!answer) {
        return "知らない。";
    }
    return answer ? answer : "知らない。";
}

export async function googleChat(messages: Content[]) {
    const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: messages,
    });
    const answer = response.text;
    if (!answer) {
        return "知らない。";
    }
    return answer ? answer : "知らない。";
}

// test function
async function testGoogleChat() {
    const messages: Content[] = [
        {
            role: "user",
            parts: [{ text: "Hello, how are you?" }],
        },
    ];
    const response = await googleChat(messages);
    console.log(response);
}
