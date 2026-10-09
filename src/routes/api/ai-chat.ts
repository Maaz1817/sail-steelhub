import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type ChatMessage = { role: "user" | "assistant"; content: string };
type AiProvider = "builtin" | "ollama" | "openai";

const SYSTEM_PROMPT = `You are Steelix AI, the official AI assistant for SAIL — Salem Steel Plant.
Give professional, practical and concise guidance about plant safety, PPE, emergency response, stainless-steel processes, training, HR and this Arivu employee app.
Use simple language. Never invent official HR records, policy values or circular references.`;

async function verifyEmployee(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  const token = authHeader.slice(7);
  if (token.split(".").length !== 3) return false;

  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

  if (!url || !key) return false;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  return Boolean(!error && data?.claims?.sub);
}

function getAiProvider(): AiProvider {
  const configured = process.env["AI_PROVIDER"]?.trim().toLowerCase();

  if (configured === "openai" || configured === "ollama" || configured === "builtin") {
    return configured;
  }

  // Vercel cannot reach Ollama running on a user's own computer.
  return process.env["VERCEL"] ? "builtin" : "ollama";
}

function languageOf(text: string): "ta" | "hi" | "en" {
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta";
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  return "en";
}

function builtInReply(question: string): string {
  const query = question.toLowerCase();
  const language = languageOf(question);

  const englishIntro = "Steelix AI";
  const tamilIntro = "Steelix AI உதவி";
  const hindiIntro = "Steelix AI सहायता";

  if (/(hello|hi|vanakkam|namaste|help)/.test(query)) {
    if (language === "ta") {
      return `${tamilIntro}: வணக்கம்! பாதுகாப்பு, பயிற்சி, எஃகு செயல்முறை, HR, circulars, forms அல்லது Arivu app பற்றிக் கேளுங்கள்.`;
    }
    if (language === "hi") {
      return `${hindiIntro}: नमस्ते! सुरक्षा, प्रशिक्षण, स्टील प्रक्रिया, HR, circulars, forms या Arivu app के बारे में पूछिए।`;
    }
    return `${englishIntro}: Hello! Ask me about safety, training, steel processes, HR guidance, circulars, forms or using the Arivu app.`;
  }

  if (/(safety|ppe|helmet|fire|emergency|accident|hazard|unsafe)/.test(query)) {
    if (language === "ta") {
      return `முதலில் பாதுகாப்பு: வேலைக்கு தேவையான PPE அணியுங்கள் — helmet, safety shoes, gloves, eye/face protection மற்றும் area-specific PPE. அபாயம் அல்லது விபத்து இருந்தால் வேலை நிறுத்தி, supervisor மற்றும் safety control room-ஐ உடனே தகவல் அளித்து, plant emergency procedure-ஐ பின்பற்றுங்கள்.`;
    }
    if (language === "hi") {
      return `सुरक्षा पहले: आवश्यक PPE पहनें — helmet, safety shoes, gloves, eye/face protection और area-specific PPE। खतरा या दुर्घटना होने पर काम रोकें, supervisor और safety control room को तुरंत बताएं तथा plant emergency procedure का पालन करें।`;
    }
    return `Safety first: wear the required PPE—helmet, safety shoes, gloves, eye/face protection and area-specific PPE. If there is a hazard or accident, stop work, inform your supervisor and safety control room immediately, and follow the plant emergency procedure.`;
  }

  if (/(quiz|question|exam|training|learn)/.test(query)) {
    return `${englishIntro}: I can help you understand a quiz topic. Read the question carefully, identify the safety or process concept being tested, and choose the answer supported by your training material. Send the quiz question and I will explain the concept step by step.`;
  }

  if (/(steel|stainless|cold roll|rolling|anneal|pickl|coil|quality)/.test(query)) {
    return `${englishIntro}: For steel-process questions, start with the process purpose, key operating controls, quality checks and safety precautions. For example, cold rolling reduces thickness and improves surface finish; follow the approved SOP, machine guarding requirements and inspection standards for your area. Tell me the exact process or issue for focused guidance.`;
  }

  if (/(leave|salary|pay|hr|designation|profile|employee id|password)/.test(query)) {
    return `${englishIntro}: For personal HR information, salary, leave balance, designation changes or account access, use your Profile section where available. For an official correction, contact the HR or IT department because only they can confirm or change employee records.`;
  }

  if (/(circular|form|announcement|activity|photo|download|notification|birthday|anniversary)/.test(query)) {
    return `${englishIntro}: Open the relevant Arivu section: Circulars for notices, Forms for downloads, Activities for photos and learning updates, and Notifications for announcements, birthdays and anniversaries. If an upload or download does not work, refresh once and report the file name to the administrator.`;
  }

  if (language === "ta") {
    return `${tamilIntro}: உங்கள் கேள்வியை இன்னும் குறிப்பாக எழுதுங்கள். பாதுகாப்பு, training, steel process, HR அல்லது Arivu app உதவிக்கு நான் வழிகாட்ட முடியும். Official personal records-க்கு HR அல்லது IT department-ஐ தொடர்பு கொள்ளுங்கள்.`;
  }

  if (language === "hi") {
    return `${hindiIntro}: कृपया अपना प्रश्न थोड़ा और स्पष्ट लिखें। मैं सुरक्षा, training, steel process, HR या Arivu app में मार्गदर्शन कर सकता हूँ। Official personal records के लिए HR या IT department से संपर्क करें।`;
  }

  return `${englishIntro}: Please share a little more detail. I can guide you on safety, training, steel processes, HR basics or using the Arivu app. For official personal records, contact HR or IT.`;
}

function sseResponse(text: string) {
  const encoder = new TextEncoder();
  const parts = text.match(/\S+\s*/g) ?? [text];

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: part } }] })}\n\n`),
        );
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive",
    },
  });
}

function ollamaToSse(stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let pending = "";

  function emitLine(line: string, controller: TransformStreamDefaultController<Uint8Array>) {
    if (!line.trim()) return;

    try {
      const item = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
      const content = item.message?.content;

      if (content) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`),
        );
      }

      if (item.done) controller.enqueue(encoder.encode("data: [DONE]\n\n"));
    } catch {
      // Ignore malformed provider chunks.
    }
  }

  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        pending += decoder.decode(chunk, { stream: true });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) emitLine(line, controller);
      },
      flush(controller) {
        pending += decoder.decode();
        emitLine(pending, controller);
      },
    }),
  );
}

export const Route = createFileRoute("/api/ai-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await verifyEmployee(request))) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: { messages?: ChatMessage[] };
        try {
          body = (await request.json()) as { messages?: ChatMessage[] };
        } catch {
          return new Response("Invalid request body", { status: 400 });
        }

        const history = (body.messages ?? [])
          .filter((message) => (message.role === "user" || message.role === "assistant") && typeof message.content === "string")
          .slice(-16)
          .map((message) => ({ role: message.role, content: message.content.slice(0, 4000) }));

        const latestQuestion = [...history].reverse().find((message) => message.role === "user")?.content;

        if (!latestQuestion) {
          return new Response("No message provided", { status: 400 });
        }

        const provider = getAiProvider();

        if (provider === "builtin") {
          return sseResponse(builtInReply(latestQuestion));
        }

        try {
          let upstream: Response;

          if (provider === "ollama") {
            const baseUrl = (process.env["OLLAMA_BASE_URL"]?.trim() || "http://127.0.0.1:11434").replace(/\/$/, "");
            const model = process.env["OLLAMA_MODEL"]?.trim() || "llama3.2:3b";

            upstream = await fetch(`${baseUrl}/api/chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model,
                stream: true,
                messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
              }),
              signal: request.signal,
            });
          } else {
            const apiKey = process.env["OPENAI_API_KEY"];
            if (!apiKey) return sseResponse(builtInReply(latestQuestion));

            const model = process.env["OPENAI_MODEL"]?.trim() || "gpt-5-mini";

            upstream = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model,
                stream: true,
                messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
              }),
              signal: request.signal,
            });
          }

          if (!upstream.ok || !upstream.body) {
            return sseResponse(builtInReply(latestQuestion));
          }

          return new Response(provider === "ollama" ? ollamaToSse(upstream.body) : upstream.body, {
            status: 200,
            headers: {
              "content-type": "text/event-stream; charset=utf-8",
              "cache-control": "no-store",
              connection: "keep-alive",
            },
          });
        } catch {
          // A deployed site cannot reach a local Ollama server. Keep Steelix available.
          return sseResponse(builtInReply(latestQuestion));
        }
      },
    },
  },
});