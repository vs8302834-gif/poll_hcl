import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./VoterPoll.css";
import { API_URL, WS_URL } from "../config";



const optionColors = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#f59e0b",
  "#06b6d4",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
];

function getVoterId() {
  let voterId = localStorage.getItem("poll_voter_id");

  if (!voterId) {
    voterId = "voter_" + crypto.randomUUID();

    localStorage.setItem("poll_voter_id", voterId);
  }

  return voterId;
}

function VoterPoll() {

  const { shareToken } = useParams();

  const [poll, setPoll] = useState(null);
  const [selectedOption, setSelectedOption] = useState("");
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  
  // FETCH POLL
  

  useEffect(() => {

    const fetchPoll = async () => {

      try {

        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_URL}/api/polls/share/${shareToken}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Poll not found"
          );
        }

        setPoll(data.poll || data);

      } catch (err) {

        setError(
          err.message || "Unable to load poll"
        );

      } finally {

        setLoading(false);
      }
    };

    fetchPoll();

  }, [shareToken]);

  
  // REALTIME WEBSOCKET
 

  useEffect(() => {

    if (!shareToken) {
      return;
    }

    const websocket = new WebSocket(
      `${WS_URL}/api/polls/share/${shareToken}/ws`
    );

    websocket.onopen = () => {

      console.log(
        "Voter WebSocket connected"
      );
    };

    websocket.onmessage = (event) => {

      try {

        const data = JSON.parse(event.data);

        console.log(
          "Realtime voter update:",
          data
        );

        
        // UPDATE POLL STATUS / EXPIRATION
        

        if (data.poll) {

          setPoll((previous) => {

            if (!previous) {
              return data.poll;
            }

            return {
              ...previous,
              ...data.poll,
            };
          });
        }

      } catch (err) {

        console.error(
          "WebSocket message error:",
          err
        );
      }
    };

    websocket.onerror = (error) => {

      console.error(
        "Voter WebSocket error:",
        error
      );
    };

    websocket.onclose = () => {

      console.log(
        "Voter WebSocket disconnected"
      );
    };

    return () => {
      websocket.close();
    };

  }, [shareToken]);

  
  // UPDATE CLOCK
 

  useEffect(() => {

    const timer = setInterval(() => {

      setCurrentTime(
        new Date()
      );

    }, 1000);

    return () => {
      clearInterval(timer);
    };

  }, []);

 
  // AUTOMATIC EXPIRATION
  

  useEffect(() => {

    if (!poll?.expiresAt) {
      return;
    }

    const expirationTime =
      new Date(poll.expiresAt);

    if (
      currentTime >= expirationTime &&
      poll.status === "active"
    ) {

      setPoll((previous) => {

        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          status: "expired",
        };
      });
    }

  }, [currentTime, poll]);

  
  // TIMER TEXT
  

  const getTimerText = () => {

    if (!poll?.expiresAt) {
      return null;
    }

    
    if (poll.status === "closed") {
      return "Closed";
    }

    if (poll.status === "expired") {
      return "Ended";
    }

    const expirationTime =
      new Date(poll.expiresAt);

    const difference =
      expirationTime.getTime() -
      currentTime.getTime();

    if (difference <= 0) {
      return "Ended";
    }

    const totalSeconds =
      Math.floor(difference / 1000);

    const days =
      Math.floor(
        totalSeconds / 86400
      );

    const hours =
      Math.floor(
        (totalSeconds % 86400) / 3600
      );

    const minutes =
      Math.floor(
        (totalSeconds % 3600) / 60
      );

    const seconds =
      totalSeconds % 60;

    if (days > 0) {

      return `${days}d ${String(
        hours
      ).padStart(2, "0")}:${String(
        minutes
      ).padStart(2, "0")}:${String(
        seconds
      ).padStart(2, "0")}`;
    }

    return `${String(
      hours
    ).padStart(2, "0")}:${String(
      minutes
    ).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")}`;
  };

  
  // POLL STATUS
 

  const getPollStatus = () => {

    if (!poll) {
      return "active";
    }

    
    if (poll.status === "closed") {
      return "closed";
    }

    if (poll.status === "expired") {
      return "expired";
    }

    if (poll.expiresAt) {

      const expirationTime =
        new Date(poll.expiresAt);

      if (currentTime >= expirationTime) {
        return "expired";
      }
    }

    return "active";
  };

  const pollStatus =
    getPollStatus();

  const timerText =
    getTimerText();

  
  // VOTE
  

  const handleVote = async () => {

    if (!selectedOption) {

      setMessage(
        "Please select an option."
      );

      return;
    }

    if (pollStatus !== "active") {

      setMessage(
        pollStatus === "expired"
          ? "This poll has expired."
          : "This poll is closed."
      );

      return;
    }

    try {

      setVoting(true);
      setMessage("");

      const voterId =
        getVoterId();

      const response = await fetch(
        `${API_URL}/api/polls/share/${shareToken}/vote`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            optionId:
              selectedOption,

            voterId:
              voterId,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {

        throw new Error(
          data.error ||
          "Unable to submit vote"
        );
      }

      setMessage(
        "Vote submitted successfully!"
      );

      setSelectedOption("");

    } catch (err) {

      setMessage(
        err.message ||
        "Something went wrong while voting."
      );

    } finally {

      setVoting(false);
    }
  };

  

  if (loading) {

    return (
      <div className="voter-page">

        <div className="voter-card voter-loading">
          Loading...
        </div>

      </div>
    );
  }

  

  if (error || !poll) {

    return (
      <div className="voter-page">

        <div className="voter-card voter-error">

          <div className="voter-error-icon">
            !
          </div>

          <h2>
            Poll unavailable
          </h2>

          <p>
            {error ||
              "This poll could not be found."}
          </p>

        </div>

      </div>
    );
  }

  

  return (
    <div className="voter-page">

      <div className="voter-card">

        {/* TOP BAR */}

        <div className="voter-top-bar">

          <button
            className="voter-back-btn"
            onClick={() =>
              window.history.back()
            }
          >
            ← Back
          </button>

          <div
            className={`voter-status status-${pollStatus}`}
          >

            <span className="voter-status-dot"></span>

            {pollStatus === "active"
              ? "Active"
              : pollStatus === "expired"
              ? "Expired"
              : "Closed"}

          </div>

          {timerText && (

            <div className="voter-timer">

              ◷ {timerText}

            </div>

          )}

        </div>

        {/* QUESTION */}

        <div className="voter-question-area">

          <h1 className="voter-question">

            {poll.question}

          </h1>

          {poll.expiresAt && (

            <div className="voter-end-time">

              {pollStatus === "active"
                ? `Ends ${new Date(
                    poll.expiresAt
                  ).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}`
                : pollStatus === "closed"
                ? `Closed`
                : `Ended ${new Date(
                    poll.expiresAt
                  ).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}`}

            </div>

          )}

        </div>

        {/* OPTIONS */}

        <div className="voter-options">

          {poll.options?.map(
            (option, index) => {

              const color =
                optionColors[
                  index %
                    optionColors.length
                ];

              const isSelected =
                selectedOption ===
                option.id;

              return (

                <button
                  key={option.id}

                  className={`voter-option ${
                    isSelected
                      ? "selected"
                      : ""
                  }`}

                  style={{
                    "--option-color":
                      color,
                  }}

                  onClick={() =>
                    pollStatus ===
                      "active" &&
                    setSelectedOption(
                      option.id
                    )
                  }

                  disabled={
                    pollStatus !==
                    "active"
                  }
                >

                  <span
                    className="voter-option-dot"

                    style={{
                      background:
                        color,

                      boxShadow:
                        `0 0 8px ${color}`,
                    }}
                  ></span>

                  <span className="voter-option-text">

                    {option.text}

                  </span>

                  {isSelected && (

                    <span
                      className="voter-check"

                      style={{
                        color: color,
                      }}
                    >
                      ✓
                    </span>

                  )}

                </button>
              );
            }
          )}

        </div>

        {/* VOTE BUTTON */}

        <button
          className="voter-submit-btn"

          onClick={handleVote}

          disabled={
            voting ||
            !selectedOption ||
            pollStatus !==
              "active"
          }
        >

          {pollStatus === "expired"
            ? "Poll Expired"
            : pollStatus === "closed"
            ? "Poll Closed"
            : voting
            ? "Submitting..."
            : "Vote"}

        </button>

        {/* MESSAGE */}

        {message && (

          <div
            className={`voter-message ${
              message.includes(
                "successfully"
              )
                ? "success"
                : ""
            }`}
          >

            {message}

          </div>

        )}

      </div>

    </div>
  );
}

export default VoterPoll;
