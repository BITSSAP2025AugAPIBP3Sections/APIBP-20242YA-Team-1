import React, { useState } from "react";
import { FiSend } from "react-icons/fi";

const AIAssistant = () => {
  const [input, setInput] = useState("");
  const [activeChat, setActiveChat] = useState<number | null>(null);

  const [messages, setMessages] = useState<
    { sender: string; text: string; time: string }[]
  >([]);

  // Stores all chats
  const [chatHistory, setChatHistory] = useState<
    { title: string; msgs: { sender: string; text: string; time: string }[] }[]
  >([]);

  const sendMessage = () => {
    if (!input.trim()) return;

    const currentTime = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const userMsg = { sender: "user", text: input, time: currentTime };
    let updatedMessages = [...messages, userMsg];

    // Create new chat if none selected
    if (activeChat === null) {
      const title =
        input.length > 22 ? input.substring(0, 22) + "..." : input;

      setChatHistory((prev) => [
        { title, msgs: updatedMessages },
        ...prev,
      ]);

      setActiveChat(0);
    } else {
      let updated = [...chatHistory];
      updated[activeChat].msgs = updatedMessages;
      setChatHistory(updated);
    }

    setMessages(updatedMessages);
    setInput("");

    // Bot response
    setTimeout(() => {
      const botMsg = {
        sender: "bot",
        text: "VendorIQ Assistant response.",
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      let botUpdated = [...updatedMessages, botMsg];

      if (activeChat !== null) {
        let updated = [...chatHistory];
        updated[activeChat].msgs = botUpdated;
        setChatHistory(updated);
      }

      setMessages(botUpdated);
    }, 600);
  };

  const handleEnter = (e: any) => {
    if (e.key === "Enter") sendMessage();
  };

  return (
    <div
  className="flex flex-col bg-gray-100 dark:bg-[#121212] text-black dark:text-white 
             h-full min-h-[calc(100vh-64px)]"
>

      {/* HEADER */}
      <div className="p-5 border-b border-gray-300 dark:border-[#30363d]">
        <h1 className="text-xl font-bold">VendorIQ Assistant</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Smart AI for invoices, vendors & analytics.
        </p>
      </div>

      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* --- NEW CHAT SCREEN (CENTER INPUT BAR) --- */}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 px-4">
            <h2 className="text-3xl font-semibold mb-6">
              What are you working on?
            </h2>

            <div className="flex items-center w-[60%] max-w-[680px] 
                bg-gray-200 dark:bg-[#1e1e1e] 
                rounded-full px-5 py-3 shadow-md">
              <input
                type="text"
                placeholder="Ask anything..."
                className="flex-1 bg-transparent px-4 py-1 outline-none text-black dark:text-white"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleEnter}
              />
              <FiSend
                className="text-blue-600 dark:text-blue-500 cursor-pointer"
                size={22}
                onClick={sendMessage}
              />
            </div>
          </div>
        ) : (
          <>
            {/* --- MESSAGE LIST --- */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${
                    m.sender === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`p-3 rounded-lg max-w-[70%] text-sm shadow-sm ${
                      m.sender === "user"
                        ? "bg-blue-600 dark:bg-blue-500 text-white"
                        : "bg-gray-200 dark:bg-[#1e1e1e] text-black dark:text-gray-200"
                    }`}
                  >
                    {m.text}
                  </div>

                  {/* Timestamp */}
                  <span className="text-[10px] text-gray-500 mt-1">
                    {m.time}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AIAssistant;