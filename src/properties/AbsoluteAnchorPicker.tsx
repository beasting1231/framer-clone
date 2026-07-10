import type { StyleProps } from "@/model/types";

type HorizontalAnchor = "left" | "center" | "right";
type VerticalAnchor = "top" | "center" | "bottom";

interface AnchorOption {
  horizontal: HorizontalAnchor;
  vertical: VerticalAnchor;
  label: string;
}

const ANCHORS: AnchorOption[] = [
  { horizontal: "left", vertical: "top", label: "Top left" },
  { horizontal: "center", vertical: "top", label: "Top center" },
  { horizontal: "right", vertical: "top", label: "Top right" },
  { horizontal: "left", vertical: "center", label: "Middle left" },
  { horizontal: "center", vertical: "center", label: "Center" },
  { horizontal: "right", vertical: "center", label: "Middle right" },
  { horizontal: "left", vertical: "bottom", label: "Bottom left" },
  { horizontal: "center", vertical: "bottom", label: "Bottom center" },
  { horizontal: "right", vertical: "bottom", label: "Bottom right" },
];

function currentAnchor(pin: StyleProps["pin"]): Pick<AnchorOption, "horizontal" | "vertical"> {
  const horizontal = pin?.centerX ? "center" : pin?.right !== undefined && pin.left === undefined ? "right" : "left";
  const vertical = pin?.centerY ? "center" : pin?.bottom !== undefined && pin.top === undefined ? "bottom" : "top";
  return { horizontal, vertical };
}

function pinForAnchor({ horizontal, vertical }: AnchorOption): NonNullable<StyleProps["pin"]> {
  const pin: NonNullable<StyleProps["pin"]> = {};

  if (horizontal === "center") pin.centerX = true;
  else pin[horizontal] = 0;

  if (vertical === "center") pin.centerY = true;
  else pin[vertical] = 0;

  return pin;
}

export function AbsoluteAnchorPicker({ pin, onChange }: { pin: StyleProps["pin"]; onChange: (pin: NonNullable<StyleProps["pin"]>) => void }) {
  const active = currentAnchor(pin);

  return (
    <div className="absolute-anchor-picker" role="group" aria-label="Absolute position anchor">
      {ANCHORS.map((anchor) => {
        const selected = anchor.horizontal === active.horizontal && anchor.vertical === active.vertical;
        return (
          <button
            key={`${anchor.vertical}-${anchor.horizontal}`}
            type="button"
            className={selected ? "active" : ""}
            title={anchor.label}
            aria-label={anchor.label}
            aria-pressed={selected}
            onClick={() => onChange(pinForAnchor(anchor))}
          >
            <span />
          </button>
        );
      })}
    </div>
  );
}
