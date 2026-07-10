import type { RadialGradientAnchor } from "@/model/types";

const ANCHORS: { value: RadialGradientAnchor; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-center", label: "Top center" },
  { value: "top-right", label: "Top right" },
  { value: "center-left", label: "Middle left" },
  { value: "center", label: "Center" },
  { value: "center-right", label: "Middle right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-center", label: "Bottom center" },
  { value: "bottom-right", label: "Bottom right" },
];

export function RadialAnchorPicker({
  value = "center",
  onChange,
}: {
  value?: RadialGradientAnchor;
  onChange: (value: RadialGradientAnchor) => void;
}) {
  return (
    <div className="absolute-anchor-picker" role="group" aria-label="Radial gradient center">
      {ANCHORS.map((anchor) => {
        const selected = anchor.value === value;
        return (
          <button
            key={anchor.value}
            type="button"
            className={selected ? "active" : ""}
            title={anchor.label}
            aria-label={anchor.label}
            aria-pressed={selected}
            onClick={() => onChange(anchor.value)}
          >
            <span />
          </button>
        );
      })}
    </div>
  );
}
