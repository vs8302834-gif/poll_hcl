import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./Results.css";
import { API_URL, WS_URL } from "./config";

const OPTION_COLORS = [
  {
    main: "#ef4444",
    secondary: "#f97316",
    glow: "rgba(239, 68, 68, 0.75)",
  },
  {
    main: "#3b82f6",
    secondary: "#06b6d4",
    glow: "rgba(59, 130, 246, 0.75)",
  },
  {
    main: "#8b5cf6",
    secondary: "#ec4899",
    glow: "rgba(139, 92, 246, 0.75)",
  },
  {
    main: "#10b981",
    secondary: "#14b8a6",
    glow: "rgba(16, 185, 129, 0.75)",
  },
  {
    main: "#f59e0b",
    secondary: "#eab308",
    glow: "rgba(245, 158, 11, 0.75)",
  },
  {
    main: "#ec4899",
    secondary: "#f43f5e",
    glow: "rgba(236, 72, 153, 0.75)",
  },
  {
    main: "#06b6d4",
    secondary: "#0ea5e9",
    glow: "rgba(6, 182, 212, 0.75)",
  },
  {
    main: "#84cc16",
    secondary: "#22c55e",
    glow: "rgba(132, 204, 22, 0.75)",
  },
];

function Results() {
  const { shareToken } = useParams();
  const navigate = useNavigate();

  const [poll, setPoll] = useState(null);
  const [results, setResults] = useState([]);
  const [totalVotes, setTotalVotes] = useState(0);

  const [activeTab, setActiveTab] = useState("result");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [live, setLive] = useState(false);

  const [currentTime, setCurrentTime] = useState(
    new Date()
  );

  const [showExpirationModal, setShowExpirationModal] =
    useState(false);

  const [newExpiration, setNewExpiration] =
    useState("");

  const token = localStorage.getItem("token");

  // ==================================================
  // FETCH RESULTS
  // ==================================================

  const fetchResults = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/polls/share/${shareToken}/results`
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.error || "Failed to load results"
        );

        setLoading(false);
        return;
      }

      setPoll(data.poll);

      // Backend returns "results"
      setResults(data.results || []);

      setTotalVotes(data.totalVotes || 0);

      setLoading(false);
    } catch (error) {
      console.error("Fetch results error:", error);

      setMessage(
        "Cannot connect to backend"
      );

      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [shareToken]);

  // ==================================================
  // WEBSOCKET
  // ==================================================

  useEffect(() => {
    if (!shareToken) return;

    const websocket = new WebSocket(
      `${WS_URL}/api/polls/share/${shareToken}/ws`
    );

    websocket.onopen = () => {
      setLive(true);
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.results) {
          setResults(data.results);
        }

        if (data.totalVotes !== undefined) {
          setTotalVotes(data.totalVotes);
        }

        if (data.poll) {
          setPoll((currentPoll) => ({
            ...currentPoll,
            ...data.poll,
          }));
        }
      } catch (error) {
        console.error(
          "WebSocket message error:",
          error
        );
      }
    };

    websocket.onerror = () => {
      setLive(false);
    };

    websocket.onclose = () => {
      setLive(false);
    };

    return () => websocket.close();
  }, [shareToken]);

  // ==================================================
  // CURRENT TIME
  // ==================================================

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // ==================================================
  // AUTOMATIC EXPIRATION CHECK
  // ==================================================

  useEffect(() => {
    if (!poll?.expiresAt) return;

    if (poll.status !== "active") return;

    const expirationTime =
      new Date(poll.expiresAt).getTime();

    if (
      currentTime.getTime() >=
      expirationTime
    ) {
      setPoll((currentPoll) => ({
        ...currentPoll,
        status: "expired",
      }));
    }
  }, [currentTime, poll]);

  // ==================================================
  // WINNER
  // ==================================================

  const winningResult = useMemo(() => {
    if (!results.length) return null;

    const total = results.reduce(
      (sum, result) =>
        sum + Number(result.voteCount || 0),
      0
    );

    if (total === 0) {
      return null;
    }

    return results.reduce(
      (winner, current) =>
        !winner ||
        Number(current.voteCount || 0) >
          Number(winner.voteCount || 0)
          ? current
          : winner,
      null
    );
  }, [results]);

  const winningIndex = useMemo(() => {
    if (!winningResult) return 0;

    return results.findIndex(
      (result) =>
        result.optionId ===
        winningResult.optionId
    );
  }, [results, winningResult]);

  const winnerColor =
    OPTION_COLORS[
      Math.max(winningIndex, 0) %
        OPTION_COLORS.length
    ];

  // ==================================================
  // EXPIRATION TEXT
  // ==================================================

  const expirationText = useMemo(() => {
    if (poll?.status === "closed") {
      return "Closed";
    }

    if (
      poll?.status === "expired"
    ) {
      return "Expired";
    }

    if (!poll?.expiresAt) {
      return "No expiration";
    }

    const expiration = new Date(
      poll.expiresAt
    );

    const difference =
      expiration.getTime() -
      currentTime.getTime();

    if (difference <= 0) {
      return "Expired";
    }

    const totalMinutes = Math.floor(
      difference / (1000 * 60)
    );

    const days = Math.floor(
      totalMinutes / (60 * 24)
    );

    const hours = Math.floor(
      (totalMinutes % (60 * 24)) / 60
    );

    const minutes =
      totalMinutes % 60;

    if (days > 0) {
      return `Ends in ${days}d ${hours}h`;
    }

    if (hours > 0) {
      return `Ends in ${hours}h ${minutes}m`;
    }

    return `Ends in ${minutes}m`;
  }, [poll, currentTime]);

  // ==================================================
  // POLL STATUS
  // ==================================================

  const pollStatus = useMemo(() => {
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
        new Date(
          poll.expiresAt
        ).getTime();

      if (
        currentTime.getTime() >=
        expirationTime
      ) {
        return "expired";
      }
    }

    return "active";
  }, [poll, currentTime]);

  // ==================================================
  // SHARE
  // ==================================================

  const shareLink =
    `${window.location.origin}/poll/${shareToken}`;

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(
        shareLink
      );

      setMessage(
        "Share link copied! 📋"
      );

      setTimeout(
        () => setMessage(""),
        2000
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "Could not copy link"
      );
    }
  };

  // ==================================================
  // OPEN EXPIRATION MODAL
  // ==================================================

  const openExpirationModal = () => {
    if (poll?.expiresAt) {
      const date =
        new Date(poll.expiresAt);

      const localDate =
        new Date(
          date.getTime() -
            date.getTimezoneOffset() *
              60000
        )
          .toISOString()
          .slice(0, 16);

      setNewExpiration(
        localDate
      );
    } else {
      setNewExpiration("");
    }

    setMessage("");

    setShowExpirationModal(true);
  };

  // ==================================================
  // SAVE EXPIRATION
  // ==================================================

  const handleChangeExpiration =
    async () => {
      if (!token) {
        setMessage(
          "Please login again"
        );
        return;
      }

      if (!newExpiration) {
        setMessage(
          "Please select a date and time"
        );
        return;
      }

      const selectedDate =
        new Date(newExpiration);

      if (
        Number.isNaN(
          selectedDate.getTime()
        )
      ) {
        setMessage(
          "Invalid date and time"
        );
        return;
      }

      if (
        selectedDate.getTime() <=
        Date.now()
      ) {
        setMessage(
          "Expiration time must be in the future"
        );
        return;
      }

      try {
        const expirationISO =
          selectedDate.toISOString();

        const response =
          await fetch(
            `${API_URL}/api/polls/${shareToken}/expiration`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body: JSON.stringify({
                expiresAt:
                  expirationISO,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          setMessage(
            data.error ||
              "Failed to change expiration"
          );
          return;
        }

        if (data.poll) {
          setPoll(data.poll);
        } else {
          await fetchResults();
        }

        setShowExpirationModal(
          false
        );

        setMessage(
          "Expiration updated successfully! ⏱️"
        );

        setTimeout(
          () => setMessage(""),
          2500
        );
      } catch (error) {
        console.error(
          "Change expiration error:",
          error
        );

        setMessage(
          "Cannot connect to backend"
        );
      }
    };

  // ==================================================
  // REMOVE EXPIRATION
  // ==================================================

  const removeExpiration =
    async () => {
      if (!token) {
        setMessage(
          "Please login again"
        );
        return;
      }

      try {
        const response =
          await fetch(
            `${API_URL}/api/polls/${shareToken}/expiration`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body: JSON.stringify({
                expiresAt: "",
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          setMessage(
            data.error ||
              "Failed to remove expiration"
          );
          return;
        }

        if (data.poll) {
          setPoll(data.poll);
        } else {
          await fetchResults();
        }

        setShowExpirationModal(
          false
        );

        setMessage(
          "Expiration removed successfully! ♾️"
        );

        setTimeout(
          () => setMessage(""),
          2500
        );
      } catch (error) {
        console.error(error);

        setMessage(
          "Cannot connect to backend"
        );
      }
    };

  // ==================================================
  // CLOSE POLL
  // ==================================================

  const handleClosePoll =
    async () => {
      const confirmed =
        window.confirm(
          "Are you sure you want to close this poll?\n\nVoting will be disabled."
        );

      if (!confirmed) return;

      if (!token) {
        setMessage(
          "Please login again"
        );
        return;
      }

      try {
        const response =
          await fetch(
            `${API_URL}/api/polls/${shareToken}/close`,
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          setMessage(
            data.error ||
              "Failed to close poll"
          );
          return;
        }

        setPoll(
          (currentPoll) => ({
            ...currentPoll,
            status: "closed",
          })
        );

        setMessage(
          "Poll closed successfully 🔒"
        );

        setTimeout(
          () => setMessage(""),
          2500
        );
      } catch (error) {
        console.error(error);

        setMessage(
          "Cannot connect to backend"
        );
      }
    };

  // ==================================================
  // OPEN POLL
  // ==================================================

  const handleOpenPoll =
    async () => {
      if (!token) {
        setMessage(
          "Please login again"
        );
        return;
      }

      try {
        const response =
          await fetch(
            `${API_URL}/api/polls/${shareToken}/open`,
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          setMessage(
            data.error ||
              "Failed to open poll"
          );
          return;
        }

        setPoll(
          (currentPoll) => ({
            ...currentPoll,
            status:
              data.status ||
              "active",
          })
        );

        setMessage(
          "Poll opened successfully 🟢"
        );

        setTimeout(
          () => setMessage(""),
          2500
        );
      } catch (error) {
        console.error(error);

        setMessage(
          "Cannot connect to backend"
        );
      }
    };

  // ==================================================
  // LOADING
  // ==================================================

  if (loading) {
    return (
      <div className="results-page">

        <div className="results-main-card">

          <div className="results-loading">
            Loading results...
          </div>

        </div>

      </div>
    );
  }

  // ==================================================
  // ERROR
  // ==================================================

  if (message && !poll) {
    return (
      <div className="results-page">

        <div className="results-main-card">

          <div className="results-error">
            {message}
          </div>

          <button
            className="results-back-btn"
            onClick={() =>
              navigate("/dashboard")
            }
          >
            ← Back to Home
          </button>

        </div>

      </div>
    );
  }

  // ==================================================
  // PAGE
  // ==================================================

  return (
    <div className="results-page">

      <div className="results-main-card">

        {/* TOP BAR */}

        <div className="results-top-bar">

          <button
            className="results-back-btn"
            onClick={() =>
              navigate("/dashboard")
            }
          >
            ← Home
          </button>

          {/* POLL STATUS */}

          <div
            className={`results-live-area poll-status ${
              pollStatus === "active"
                ? "status-active"
                : pollStatus === "closed"
                ? "status-closed"
                : "status-expired"
            }`}
          >

            <span className="live-dot"></span>

            {pollStatus === "active"
              ? "Active"
              : pollStatus === "closed"
              ? "Closed"
              : "Expired"}

          </div>

          {/* EXPIRATION */}

          <div className="timer-badge">

            <span className="timer-icon">
              ◷
            </span>

            {expirationText}

          </div>

        </div>

        {/* WINNER */}

        <div
          className="winning-display"
          style={{
            "--winner-color":
              winnerColor.main,

            "--winner-secondary":
              winnerColor.secondary,

            "--winner-glow":
              winnerColor.glow,
          }}
        >

          <div className="bubble bubble-1"></div>
          <div className="bubble bubble-2"></div>
          <div className="bubble bubble-3"></div>
          <div className="bubble bubble-4"></div>

          <svg
            className="ring-svg"
            viewBox="0 0 220 220"
          >

            <defs>

              <linearGradient
                id="winnerRingGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >

                <stop
                  offset="0%"
                  stopColor={
                    winnerColor.main
                  }
                />

                <stop
                  offset="100%"
                  stopColor={
                    winnerColor.secondary
                  }
                />

              </linearGradient>

            </defs>

            <circle
              className="ring-bg"
              cx="110"
              cy="110"
              r="100"
            />

            <circle
              className="ring-progress"
              cx="110"
              cy="110"
              r="100"
              pathLength="100"
              stroke="url(#winnerRingGradient)"
              strokeDasharray="100"
              strokeDashoffset={
                winningResult
                  ? 100 -
                    Number(
                      winningResult.percentage || 0
                    )
                  : 100
              }
            />

          </svg>

          <div className="winning-percentage">

            {winningResult
              ? `${Number(
                  winningResult.percentage || 0
                ).toFixed(0)}%`
              : "0%"}

          </div>

          <div className="winning-label">
            Winning option
          </div>

          <div className="winning-option-name">

            {winningResult
              ? winningResult.text
              : "No votes yet"}

          </div>

        </div>

        {/* WAVE */}

        <div
          className="wave-track"
          style={{
            "--wave-color":
              winnerColor.glow,
          }}
        >

          <div className="wave-line"></div>
          <div className="wave-line"></div>

        </div>

        {/* QUESTION */}

        <div className="results-question">
          {poll?.question}
        </div>

        <div className="total-votes">

          {totalVotes}{" "}

          {totalVotes === 1
            ? "vote"
            : "votes"}{" "}

          total

        </div>

        {/* TABS */}

        <div className="tabs-container">

          <button
            className={`tab-btn ${
              activeTab === "result"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActiveTab("result")
            }
          >
            Result
          </button>

          <button
            className={`tab-btn ${
              activeTab === "feature"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActiveTab("feature")
            }
          >
            Manage
          </button>

        </div>

        {/* RESULTS */}

        {activeTab === "result" && (

          <div className="tab-content active">

            <div className="result-list">

              {results.length === 0 ? (

                <div className="no-results">
                  No options available.
                </div>

              ) : (

                results.map(
                  (result, index) => {

                    const optionColor =
                      OPTION_COLORS[
                        index %
                          OPTION_COLORS.length
                      ];

                    const isWinner =
                      winningResult &&
                      result.optionId ===
                        winningResult.optionId;

                    const voteCount =
                      Number(
                        result.voteCount || 0
                      );

                    const percentage =
                      Number(
                        result.percentage || 0
                      );

                    return (

                      <div
                        className={`result-item ${
                          isWinner
                            ? "winner-item"
                            : ""
                        }`}
                        key={
                          result.optionId
                        }
                        style={{
                          "--option-color":
                            optionColor.main,

                          "--option-glow":
                            optionColor.glow,
                        }}
                      >

                        <div className="result-option">

                          <span
                            className="option-color-dot"
                            style={{
                              background:
                                optionColor.main,

                              boxShadow:
                                `0 0 10px ${optionColor.glow}`,
                            }}
                          ></span>

                          <span className="option-name">

                            {result.text}

                            {isWinner && (
                              <span className="winner-tag">
                                WINNER
                              </span>
                            )}

                          </span>

                        </div>

                        <div className="result-stat">

                          <span className="result-percentage">
                            {percentage.toFixed(0)}%
                          </span>

                          <span className="vote-count">

                            {voteCount}{" "}

                            {voteCount === 1
                              ? "vote"
                              : "votes"}

                          </span>

                        </div>

                      </div>

                    );
                  }
                )

              )}

            </div>

          </div>

        )}

        {/* MANAGE */}

        {activeTab === "feature" && (

          <div className="tab-content active">

            <div className="feature-actions">

              <button
                className="feature-btn change-time"
                type="button"
                onClick={
                  openExpirationModal
                }
                disabled={
                  pollStatus === "closed"
                }
              >
                ⏱ Change Expiration
              </button>

              {pollStatus === "closed" ? (

                <button
                  className="feature-btn open-poll"
                  type="button"
                  onClick={
                    handleOpenPoll
                  }
                >
                  🟢 Open Poll
                </button>

              ) : (

                <button
                  className="feature-btn close-poll"
                  type="button"
                  onClick={
                    handleClosePoll
                  }
                  disabled={
                    pollStatus === "expired"
                  }
                >
                  🔒 Close Poll
                </button>

              )}

            </div>

          </div>

        )}

        {/* SHARE LINK */}

        <button
          className="share-link-container"
          type="button"
          onClick={
            copyShareLink
          }
        >

          <span className="link-text">
            {shareLink}
          </span>

          <span className="copy-icon">
            📋
          </span>

        </button>

        {message && poll && (

          <div className="results-message">
            {message}
          </div>

        )}

      </div>

      {/* EXPIRATION MODAL */}

      {showExpirationModal && (

        <div
          className="expiration-modal-overlay"
          onClick={() =>
            setShowExpirationModal(
              false
            )
          }
        >

          <div
            className="expiration-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="modal-icon">
              ⏱️
            </div>

            <h2>
              Change Expiration
            </h2>

            <p>
              Set when this poll should
              stop accepting votes.
            </p>

            <input
              type="datetime-local"
              value={
                newExpiration
              }
              onChange={(e) =>
                setNewExpiration(
                  e.target.value
                )
              }
            />

            <div className="modal-actions">

              <button
                className="modal-cancel"
                type="button"
                onClick={() =>
                  setShowExpirationModal(
                    false
                  )
                }
              >
                Cancel
              </button>

              <button
                className="modal-save"
                type="button"
                onClick={
                  handleChangeExpiration
                }
              >
                OK / Save
              </button>

            </div>

            {poll?.expiresAt && (

              <button
                className="remove-expiration"
                type="button"
                onClick={
                  removeExpiration
                }
              >
                Remove expiration
              </button>

            )}

          </div>

        </div>

      )}

    </div>
  );
}

export default Results;