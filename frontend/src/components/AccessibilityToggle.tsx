interface AccessibilityToggleProps {
  simpleMode: boolean;
  onToggle: (enabled: boolean) => void;
}

const AccessibilityToggle = ({
  simpleMode,
  onToggle,
}: AccessibilityToggleProps) => {
  return (
    <label style={styles.wrapper}>
      <input
        type="checkbox"
        checked={simpleMode}
        onChange={(event) => onToggle(event.target.checked)}
      />
      <span style={styles.label}>Simple mode</span>
    </label>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    marginBottom: "12px",
  },
  label: {
    userSelect: "none",
  },
};

export default AccessibilityToggle;
