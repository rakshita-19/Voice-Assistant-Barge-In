import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const [text, setText] = useState("");
  const [response, setResponse] = useState("");
  const [messages, setMessages] = useState([]);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);

  const recognitionRef = useRef(null);
  const listeningRef = useRef(false);
  const speakingRef = useRef(false);
  const processingRef = useRef(false);
  const lastTranscriptRef = useRef("");

  const speak = (message) => {
    window.speechSynthesis.cancel();

    speakingRef.current = true;
    setSpeaking(true);

    const utterance = new SpeechSynthesisUtterance(message);

    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onstart = () => {
      speakingRef.current = true;
      setSpeaking(true);
    };

    utterance.onend = () => {
      speakingRef.current = false;
      setSpeaking(false);

      if (listeningRef.current && recognitionRef.current) {
        setTimeout(() => {
          try {
            recognitionRef.current.start();
          } catch (error) {
            console.log("Recognition already running.");
          }
        }, 200);
      }
    };

    utterance.onerror = () => {
      speakingRef.current = false;
      setSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const askAI = async (transcript) => {
    if (processingRef.current) return;

    processingRef.current = true;
    setThinking(true);

    try {
      const res = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: transcript,
        }),
      });

      const data = await res.json();

      setResponse(data.reply);

      setMessages((prev) => [
        ...prev,
        { role: "user", text: transcript },
        { role: "assistant", text: data.reply },
      ]);

      speak(data.reply);
    } catch (error) {
      console.error("Backend error:", error);

      const errorMessage =
        "Sorry, I could not connect to the AI.";

      setResponse(errorMessage);

      setMessages((prev) => [
        ...prev,
        { role: "user", text: transcript },
        { role: "assistant", text: errorMessage },
      ]);

      speak(errorMessage);
    } finally {
      processingRef.current = false;
      setThinking(false);
    }
  };

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Please use Google Chrome.");
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.log("Recognition already running.");
      }
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      listeningRef.current = true;
      setListening(true);
    };

    recognition.onresult = (event) => {
      const result =
        event.results[event.results.length - 1];

      const transcript =
        result[0].transcript.trim();

      if (!transcript) return;

      // BARGE-IN
      if (speakingRef.current) {
        console.log("🔥 BARGE-IN DETECTED!");

        window.speechSynthesis.cancel();

        speakingRef.current = false;
        setSpeaking(false);

        try {
          recognition.stop();
        } catch (error) {
          console.log("Recognition stop error.");
        }

        setTimeout(() => {
          if (listeningRef.current) {
            try {
              recognition.start();
            } catch (error) {
              console.log("Recognition restart error.");
            }
          }
        }, 100);
      }

      setText(transcript);

      if (result.isFinal) {
        if (transcript === lastTranscriptRef.current) {
          console.log(
            "⛔ Duplicate transcript ignored:",
            transcript
          );
          return;
        }

        lastTranscriptRef.current = transcript;

        console.log(
          "🟢 FINAL TRANSCRIPT:",
          transcript
        );

        console.log(
          "⏱️ Sending to AI at:",
          new Date().toLocaleTimeString()
        );

        askAI(transcript);
      }
    };

    recognition.onerror = (event) => {
      console.log(
        "Speech recognition error:",
        event.error
      );

      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        listeningRef.current = false;
        setListening(false);
      }
    };

    recognition.onend = () => {
      if (listeningRef.current) {
        try {
          recognition.start();
        } catch (error) {
          console.log("Recognition restart error.");
        }
      } else {
        setListening(false);
      }
    };

    recognitionRef.current = recognition;
    listeningRef.current = true;

    recognition.start();
  };

  const stopListening = () => {
    listeningRef.current = false;

    window.speechSynthesis.cancel();

    speakingRef.current = false;
    setSpeaking(false);

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    setListening(false);
  };

  const clearConversation = () => {
    setMessages([]);
    setText("");
    setResponse("");
    setThinking(false);

    window.speechSynthesis.cancel();

    speakingRef.current = false;
    setSpeaking(false);
  };

  useEffect(() => {
    return () => {
      listeningRef.current = false;

      window.speechSynthesis.cancel();

      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="app">
      <div className="container">

        {/* HEADER */}
        <div className="header">
          <div className="logo">🎙️</div>

          <h1>Voice Assistant</h1>

          <p>
            Speak naturally. Interrupt anytime.
          </p>
        </div>

        {/* STATUS CARD */}
        <div className="status-card">

          <div
            className={`orb ${
              thinking
                ? "thinking"
                : speaking
                ? "speaking"
                : listening
                ? "listening"
                : ""
            }`}
          >
            🎙️
          </div>

          <h2>
            {thinking
              ? "Thinking..."
              : speaking
              ? "Speaking..."
              : listening
              ? "Listening..."
              : "Ready"}
          </h2>

          <p className="status-text">
            {thinking
              ? "Getting your answer..."
              : speaking
              ? "Say something to interrupt"
              : listening
              ? "I'm listening to you"
              : "Press the microphone to start"}
          </p>

          {/* BUTTONS */}
          <div className="buttons">

            {!listening ? (
              <button
                className="start-btn"
                onClick={startListening}
              >
                🎤 Start Listening
              </button>
            ) : (
              <button
                className="stop-btn"
                onClick={stopListening}
              >
                ⏹ Stop
              </button>
            )}

            <button
              className="clear-btn"
              onClick={clearConversation}
            >
              🗑️ Clear Conversation
            </button>

          </div>
        </div>

        {/* CONVERSATION */}
        <div className="conversation">

          {messages.length === 0 ? (
            <div className="message assistant-message">
              <div className="message-title">
                🤖 Assistant
              </div>

              <div className="message-text">
                Your conversation will appear here...
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`message ${
                  message.role === "user"
                    ? "user-message"
                    : "assistant-message"
                }`}
              >
                <div className="message-title">
                  {message.role === "user"
                    ? "👤 You"
                    : "🤖 Assistant"}
                </div>

                <div className="message-text">
                  {message.text}
                </div>
              </div>
            ))
          )}

        </div>

        {/* FOOTER */}
        <div className="footer">
          <span>⚡ Gemini AI</span>
          <span>•</span>
          <span>🎤 Speech Recognition</span>
          <span>•</span>
          <span>🔊 Text-to-Speech</span>
          <span>•</span>
          <span>⚡ Barge-In</span>
        </div>

      </div>
    </div>
  );
}

export default App;