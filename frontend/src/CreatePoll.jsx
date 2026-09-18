import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./CreatePoll.css";

function CreatePoll() {
  const navigate = useNavigate();

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  const [setExpiration, setSetExpiration] = useState(false);
  const [expirationTime, setExpirationTime] = useState("");

  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);

  // Add a new option
  const addOption = () => {
    setOptions([...options, ""]);
  };

  // Update an option
  const updateOption = (index, value) => {
    const updatedOptions = [...options];
    updatedOptions[index] = value;
    setOptions(updatedOptions);
  };

  // Clear default option / remove extra option
  const removeOption = (index) => {
    if (options.length <= 2) {
      // Keep minimum 2 option boxes
      const updatedOptions = [...options];
      updatedOptions[index] = "";
      setOptions(updatedOptions);
      return;
    }

    const updatedOptions = options.filter(
      (_, optionIndex) => optionIndex !== index
    );

    setOptions(updatedOptions);
  };

  const handleCreatePoll = async (e) => {
    e.preventDefault();

    // Basic frontend validation
    if (!question.trim()) {
      setMessage("Please enter a poll question");
      return;
    }

    if (options.length < 2) {
      setMessage("A poll must have at least 2 options");
      return;
    }

    const cleanedOptions = options
      .map((option) => option.trim())
      .filter((option) => option !== "");

    if (cleanedOptions.length < 2) {
      setMessage("Please provide at least 2 options");
      return;
    }

    // Prevent duplicate options
    const uniqueOptions = new Set(
      cleanedOptions.map((option) => option.toLowerCase())
    );

    if (uniqueOptions.size !== cleanedOptions.length) {
      setMessage("Options must be different");
      return;
    }

    // -----------------------------------
    // OPTIONAL EXPIRATION
    // -----------------------------------

    let selectedExpiration = null;

    if (setExpiration) {
      // If expiration checkbox is enabled,
      // an expiration time must be selected.
      if (!expirationTime) {
        setMessage("Please select an expiration time");
        return;
      }

      selectedExpiration = new Date(expirationTime);

      // Make sure expiration is in the future
      if (selectedExpiration <= new Date()) {
        setMessage("Expiration time must be in the future");
        return;
      }
    }

    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/");
      return;
    }

    setCreating(true);
    setMessage("Creating poll...");

    try {
      // Create request body
      const requestBody = {
        question: question.trim(),
        options: cleanedOptions,
      };

      // Only send expiresAt when expiration is enabled
      if (selectedExpiration) {
        requestBody.expiresAt = selectedExpiration.toISOString();
      }

      const response = await fetch("http://localhost:8080/api/polls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Failed to create poll");
        setCreating(false);
        return;
      }

      setMessage("Poll created successfully! 🎉");

      // Return to dashboard
      setTimeout(() => {
        navigate("/dashboard");
      }, 800);
    } catch (error) {
      console.error(error);
      setMessage("Cannot connect to backend");
      setCreating(false);
    }
  };

  return (
    <div className="create-page">
      <div className="create-main-card">

        {/* Header */}
        <div className="create-header">
          <button
            className="back-btn"
            type="button"
            onClick={() => navigate("/dashboard")}
          >
            ←
          </button>

          <h1>Create Poll</h1>
        </div>

        <form onSubmit={handleCreatePoll}>

          {/* Question */}
          <div
            className="create-form-group"
            style={{ marginBottom: "20px" }}
          >
            <label htmlFor="question">
              Poll Question
            </label>

            <input
              type="text"
              id="question"
              className="create-form-input"
              placeholder="e.g. What should we eat tonight?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              required
            />
          </div>

          {/* Options */}
          <div className="options-section">

            <div className="options-header">
              <label>Options</label>

              <button
                type="button"
                className="add-option-btn"
                onClick={addOption}
              >
                + Add Option
              </button>
            </div>

            {options.map((option, index) => (
              <div
                className="input-wrapper"
                key={index}
              >
                <input
                  type="text"
                  className="create-form-input"
                  placeholder={`Option ${index + 1}`}
                  value={option}
                  onChange={(e) =>
                    updateOption(index, e.target.value)
                  }
                  required
                />

                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => removeOption(index)}
                >
                  ✕
                </button>
              </div>
            ))}

          </div>

          {/* Expiration */}
          <div className="expiration-section">

            <label className="checkbox-label">

              <input
                type="checkbox"
                checked={setExpiration}
                onChange={(e) => {
                  setSetExpiration(e.target.checked);

                  if (!e.target.checked) {
                    setExpirationTime("");
                  }
                }}
              />

              <span className="checkmark"></span>

              Set Expiration Time

            </label>

            <div
              className={`time-input-wrapper ${
                setExpiration ? "show" : ""
              }`}
            >
              <input
                type="datetime-local"
                className="create-form-input"
                value={expirationTime}
                onChange={(e) =>
                  setExpirationTime(e.target.value)
                }
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>

          </div>

          {/* Message */}
          {message && (
            <p className="create-message">
              {message}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="submit-btn"
            disabled={creating}
          >
            {creating
              ? "Creating Poll..."
              : "Create Poll"}
          </button>

        </form>

      </div>
    </div>
  );
}

export default CreatePoll;