import { useRef, useState } from "react";

export function CsvImportButton({
  buttonLabel = "Import CSV",
  selectedPrefix = "Selected import:",
  buttonStyle,
  statusStyle,
  onSelect,
}) {
  const inputRef = useRef(null);
  const [selectedFileName, setSelectedFileName] = useState("");

  const openPicker = () => {
    inputRef.current?.click();
  };

  const handleChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    const nextName = file ? file.name : "";
    setSelectedFileName(nextName);
    onSelect?.(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleChange}
        style={{ display: "none" }}
      />
      <button onClick={openPicker} style={buttonStyle}>
        {buttonLabel}
      </button>
      {selectedFileName && (
        <div style={statusStyle}>
          {selectedPrefix} {selectedFileName}
        </div>
      )}
    </div>
  );
}
