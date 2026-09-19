import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "./config";

function Dashboard() {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    fetchPolls();
  }, []);

  const fetchPolls = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/polls`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Failed to load polls");
        setLoading(false);
        return;
      }

      setPolls(data.polls || []);
      setLoading(false);
    } catch (error) {
      console.error(error);
      setMessage("Cannot connect to backend");
      setLoading(false);
    }
  };

  const handleCreatePoll = () => {
    navigate("/create");
  };

  const handlePollClick = (poll) => {
     navigate(`/results/${poll.shareToken}`);
  };

  

  const getPollStatus = (poll) => {
    if (poll.status === "closed") {
      return "closed";
    }

    if (poll.status === "expired") {
      return "expired";
    }

    if (poll.expiresAt) {
      if (new Date(poll.expiresAt) <= new Date()) {
        return "expired";
      }
    }

    return "active";
  };

  

  const handleDeletePoll = async (poll) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${poll.question}"?`
    );

    if (!confirmed) {
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/polls/${poll.shareToken}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to delete poll");
        return;
      }

      
      setPolls((currentPolls) =>
        currentPolls.filter(
          (currentPoll) =>
            currentPoll.shareToken !== poll.shareToken
        )
      );

    } catch (error) {
      console.error(error);
      alert("Cannot connect to backend");
    }
  };

  return (
    <div className="dashboard-page">
      <div className="main-card">

        {/* Featured Poll */}
        <div className="featured-poll">
          <h2>🔥 Featured Poll</h2>
        </div>

        {/* Create Poll */}
        <div className="create-poll-wrapper">
          <button
            className="create-poll-btn"
            onClick={handleCreatePoll}
          >
            <span className="plus-icon">+</span>
            Create Poll
          </button>
        </div>

        {/* Your Polls */}
        <div className="polls-list">

          <div className="polls-list-title">
            Your Polls
          </div>

          {loading && (
            <div className="empty-message">
              Loading polls...
            </div>
          )}

          {!loading && message && (
            <div className="empty-message">
              {message}
            </div>
          )}

          {!loading && !message && polls.length === 0 && (
            <div className="empty-message">
              No records found
            </div>
          )}

          {!loading &&
            !message &&
            polls.map((poll) => {

              const status = getPollStatus(poll);

              return (
                <div
                  className="poll-item"
                  key={poll.id}
                  onClick={() => handlePollClick(poll)}
                >
                  <div className="poll-info">

                    <span className="poll-question">
                      {poll.question}
                    </span>

                    <span
                      className={`status-badge ${
                        status === "active"
                          ? "active"
                          : "ended"
                      }`}
                    >
                      <span className="dot"></span>

                      {status === "active"
                        ? "Active"
                        : status === "closed"
                        ? "Closed"
                        : "Ended"}
                    </span>

                  </div>

                  {/* Poll Actions */}
                  <div className="poll-actions">

                    <button
                      className="delete-poll-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePoll(poll);
                      }}
                      title="Delete Poll"
                    >
                      🗑️
                    </button>

                    <span className="arrow">
                      ›
                    </span>

                  </div>

                </div>
              );
            })}

        </div>

      </div>
    </div>
  );
}

export default Dashboard;
