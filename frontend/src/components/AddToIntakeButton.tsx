type AddToIntakeButtonProps = {
  onAdd: () => void;
  disabled?: boolean;
  addedToday?: boolean;
};

const AddToIntakeButton = ({
  onAdd,
  disabled = false,
  addedToday = false
}: AddToIntakeButtonProps) => (
  <button
    type="button"
    className={`ghost-action compact add-intake-button ${addedToday ? "logged" : ""}`}
    onClick={onAdd}
    disabled={disabled}
  >
    {addedToday ? "Add another serving" : "Add to daily intake"}
  </button>
);

export default AddToIntakeButton;
