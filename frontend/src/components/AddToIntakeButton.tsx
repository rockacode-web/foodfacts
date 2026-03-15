import { useState } from "react";

type AddToIntakeButtonProps = {
  onAdd: (servings: number) => void | Promise<void>;
  disabled?: boolean;
  addedToday?: boolean;
  isSaving?: boolean;
  error?: string;
  successMessage?: string;
};

const AddToIntakeButton = ({
  onAdd,
  disabled = false,
  addedToday = false,
  isSaving = false,
  error = "",
  successMessage = ""
}: AddToIntakeButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [servings, setServings] = useState("1");

  const confirmAdd = async () => {
    const parsed = Number(servings);
    const normalizedServings =
      Number.isFinite(parsed) && parsed > 0 ? Math.max(1, Math.round(parsed)) : 1;
    await onAdd(normalizedServings);
    setServings("1");
    setIsOpen(false);
  };

  return (
    <div className="intake-add-control">
      <button
        type="button"
        className={`ghost-action compact add-intake-button ${addedToday ? "logged" : ""}`}
        onClick={() => setIsOpen((current) => !current)}
        disabled={disabled || isSaving}
      >
        {isSaving ? "Saving..." : addedToday ? "Add another serving" : "Add to daily intake"}
      </button>

      {isOpen && (
        <div className="intake-add-popover">
          <label className="intake-serving-field" htmlFor="servings">
            <span>Servings</span>
            <input
              id="servings"
              type="number"
              min="1"
              step="1"
              value={servings}
              onChange={(event) => setServings(event.target.value)}
            />
          </label>

          <div className="intake-add-actions">
            <button
              type="button"
              className="primary-action compact-primary"
              onClick={() => {
                void confirmAdd();
              }}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Confirm"}
            </button>
            <button
              type="button"
              className="ghost-action compact"
              onClick={() => setIsOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>

          {error ? <p className="error-text">{error}</p> : null}
          {!error && successMessage ? <p className="success-text">{successMessage}</p> : null}
        </div>
      )}
    </div>
  );
};

export default AddToIntakeButton;
