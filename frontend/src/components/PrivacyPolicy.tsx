import React from "react";

export const PrivacyPolicy: React.FC = () => (
  <div className="min-h-screen bg-[#080808] text-zinc-300 font-mono">
    <div className="max-w-3xl mx-auto px-6 py-16">

      {/* Header */}
      <div className="border-b border-zinc-800 pb-8 mb-10">
        <p className="text-[11px] tracking-widest text-[#00E5FF] uppercase mb-2">J.A.R.V.I.S. — Personal AI Operating System</p>
        <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
        <p className="text-xs text-zinc-500 mt-2">Effective date: August 27, 2026 · Last updated: August 27, 2026</p>
      </div>

      {/* TL;DR */}
      <div className="border-l-2 border-[#00E5FF] bg-[#111318] px-5 py-4 mb-10 text-sm text-zinc-300 leading-relaxed">
        <strong className="text-white">Short version:</strong> JARVIS is a self-hosted AI assistant.
        Your data is processed by the third-party AI APIs you configure (OpenAI, Google Gemini,
        ElevenLabs, etc.) and stored on your own backend. We do not collect, sell, or share your personal data.
      </div>

      <div className="space-y-10 text-sm leading-relaxed">

        <Section title="1. Who We Are">
          JARVIS – AI Assistant ("JARVIS", "the App", "we") is an open-source personal AI operating
          system developed by Pratham Rathod. The App connects your device to a backend server that
          you control (self-hosted or deployed via Railway). Questions can be directed to{" "}
          <a href="mailto:rathod.pr@northeastern.edu" className="text-[#00E5FF] hover:underline">
            rathod.pr@northeastern.edu
          </a>.
        </Section>

        <Section title="2. Data We Collect">
          <p className="mb-4">We collect only what is necessary to provide the App's functionality:</p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <Th>Data type</Th><Th>Purpose</Th><Th>Stored where</Th>
              </tr>
            </thead>
            <tbody>
              <Tr><Td>Account credentials (email, hashed password)</Td><Td>Authentication</Td><Td>Your backend database</Td></Tr>
              <Tr><Td>Chat messages</Td><Td>AI response generation</Td><Td>Your backend; forwarded to AI API</Td></Tr>
              <Tr><Td>Voice audio</Td><Td>Speech-to-text transcription</Td><Td>Processed in memory; not persisted</Td></Tr>
              <Tr><Td>Camera images / video frames</Td><Td>Face recognition, scene analysis</Td><Td>Processed in memory; embeddings on your backend if enrolled</Td></Tr>
              <Tr><Td>Enrolled face photos</Td><Td>Biometric recognition (opt-in)</Td><Td>Your backend database</Td></Tr>
              <Tr><Td>Tasks, schedules, reminders, notes</Td><Td>Productivity features</Td><Td>Your backend database</Td></Tr>
              <Tr><Td>Research queries</Td><Td>Web research via Tavily / Exa</Td><Td>Forwarded to search API; not persisted</Td></Tr>
            </tbody>
          </table>
          <p className="mt-4 text-zinc-400">We do <strong className="text-white">not</strong> collect analytics, advertising identifiers, or device telemetry.</p>
        </Section>

        <Section title="3. Third-Party AI Services">
          <p className="mb-3">JARVIS routes requests to third-party AI providers depending on your configuration. Each has its own privacy policy:</p>
          <ul className="space-y-1.5 text-zinc-400">
            {[
              ["OpenAI", "chat, agents, STT", "openai.com/policies/privacy-policy"],
              ["Google Gemini / Vertex AI", "vision, chat", "policies.google.com/privacy"],
              ["Groq", "fast inference", "groq.com/privacy-policy"],
              ["ElevenLabs", "text-to-speech", "elevenlabs.io/privacy"],
              ["Tavily / Exa", "web search", "tavily.com/privacy"],
            ].map(([name, use, url]) => (
              <li key={name} className="flex gap-2">
                <span className="text-[#00E5FF] shrink-0">▸</span>
                <span><strong className="text-white">{name}</strong> — {use} &nbsp;
                  <a href={`https://${url}`} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-[#00E5FF] transition">{url}</a>
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="4. Camera and Microphone">
          The App requests camera and microphone permissions only when you actively use Vision Mode
          or Voice Mode. Frames and audio are sent to your backend over HTTPS for processing. We do
          not record or store raw audio or video beyond the current session.
          <br /><br />
          Face enrollment is strictly opt-in. You explicitly add people by name and photo and can
          delete any enrolled identity at any time from the Vision screen.
        </Section>

        <Section title="5. Data Sharing">
          We do not sell, rent, or share your data with any third party for advertising or commercial
          purposes. Data is shared only with the AI APIs listed in Section 3 to fulfil your request,
          or if required by law.
        </Section>

        <Section title="6. Data Retention">
          Because JARVIS is self-hosted, <strong className="text-white">you control retention</strong>.
          Chat history, tasks, schedules, and enrolled faces are stored in your database and can be
          deleted at any time. We have no access to your database.
        </Section>

        <Section title="7. Security">
          All communication between the App and your backend is encrypted via HTTPS/TLS. Passwords
          are hashed using bcrypt before storage. API keys are stored server-side only and never
          sent to the mobile client.
        </Section>

        <Section title="8. Children's Privacy">
          JARVIS is not directed at children under 13 (or under 16 in the EU). We do not knowingly
          collect personal data from children. Contact us if you believe a child has provided
          personal information and we will delete it.
        </Section>

        <Section title="9. Your Rights">
          Depending on your jurisdiction you may have the right to access, correct, or delete your
          personal data, or withdraw consent at any time by uninstalling the App and clearing your
          backend database. EU/UK users may lodge a complaint with a supervisory authority. Contact{" "}
          <a href="mailto:rathod.pr@northeastern.edu" className="text-[#00E5FF] hover:underline">
            rathod.pr@northeastern.edu
          </a>{" "}for any requests.
        </Section>

        <Section title="10. Changes to This Policy">
          We may update this policy as the App evolves. Material changes will be noted in the App's
          release notes. The "Last updated" date at the top reflects the most recent revision.
        </Section>

        <Section title="11. Contact">
          <div className="space-y-1 text-zinc-400">
            <p><span className="text-white">Pratham Rathod</span></p>
            <p>MS Computer Science, Northeastern University</p>
            <p><a href="mailto:rathod.pr@northeastern.edu" className="text-[#00E5FF] hover:underline">rathod.pr@northeastern.edu</a></p>
            <p><a href="https://github.com/rathodpratham15/JARVIS" target="_blank" rel="noopener noreferrer" className="text-[#00E5FF] hover:underline">github.com/rathodpratham15/JARVIS</a></p>
          </div>
        </Section>

      </div>

      <div className="border-t border-zinc-800 mt-12 pt-6 text-center text-xs text-zinc-600">
        © 2026 Pratham Rathod · JARVIS – AI Assistant · Open Source (MIT)
      </div>
    </div>
  </div>
);

// ── helpers ──────────────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h2 className="text-[11px] font-bold tracking-widest uppercase text-[#00E5FF] border-b border-zinc-800 pb-2 mb-3">
      {title}
    </h2>
    <div className="text-zinc-400 leading-relaxed">{children}</div>
  </div>
);

const Th: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <th className="text-left px-3 py-2 bg-[#111318] text-white font-bold border border-zinc-800">{children}</th>
);
const Tr: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tr className="border-b border-zinc-800/50">{children}</tr>
);
const Td: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <td className="px-3 py-2 border border-zinc-800 align-top">{children}</td>
);
