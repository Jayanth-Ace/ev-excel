import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";

/** The small, non-interactive mascot state used by the EV empty state. */
export type EvCatState = "sleeping" | "idle" | "awake" | "thinking";

/**
 * Lightweight inline SVG mascot for the task pane.
 *
 * The element intentionally owns no application state and has no external
 * assets. Its animation is CSS-driven so reduced-motion preferences can
 * disable it without involving the task pane runtime.
 */
@customElement("ev-cat")
export class EvCat extends LitElement {
  @property() state: EvCatState = "sleeping";
  @property({ type: Number }) size = 92;

  protected override createRenderRoot() {
    return this;
  }

  override render() {
    const sleeping = this.state === "sleeping" || this.state === "idle";
    const thinking = this.state === "thinking";
    const height = Math.round(this.size * 130 / 160);

    return html`
      <svg
        class="ev-cat__svg"
        viewBox="0 0 160 130"
        width=${this.size}
        height=${height}
        role="img"
        aria-label="EV mascot cat"
      >
        <rect class="ev-cat__desk" x="0" y="104" width="160" height="26" rx="3" />
        <rect class="ev-cat__desk-edge" x="0" y="104" width="160" height="4" rx="2" />

        <rect class="ev-cat__monitor" x="7" y="76" width="28" height="20" rx="2.5" />
        <rect class="ev-cat__monitor" x="18.5" y="96" width="5" height="6" />
        <rect class="ev-cat__desk-edge" x="14" y="101" width="14" height="2.5" rx="1.2" />
        <rect class="ev-cat__monitor-glow" x="9.5" y="78" width="23" height="16" rx="1.5" />
        <line class="ev-cat__monitor-line" x1="12" y1="82" x2="30" y2="82" />
        <line class="ev-cat__monitor-line ev-cat__monitor-line--mid" x1="12" y1="85.5" x2="26" y2="85.5" />
        <line class="ev-cat__monitor-line ev-cat__monitor-line--low" x1="12" y1="89" x2="29" y2="89" />

        <rect class="ev-cat__notebook" x="2" y="98" width="20" height="14" rx="1.5" />
        <line class="ev-cat__desk-line" x1="5.5" y1="104" x2="19.5" y2="104" />
        <line class="ev-cat__desk-line" x1="5.5" y1="107" x2="19.5" y2="107" />
        <line class="ev-cat__desk-line ev-cat__desk-line--short" x1="5.5" y1="110" x2="15" y2="110" />

        <rect class="ev-cat__mug" x="127" y="88" width="16" height="15" rx="2.5" />
        <path class="ev-cat__mug" d="M143 91.5Q150 91.5 150 95.5Q150 99.5 143 99.5" />
        <path class="ev-cat__steam ev-cat__steam--one" d="M132 87Q133.5 83 132 79" />
        <path class="ev-cat__steam ev-cat__steam--two" d="M136.5 87Q138 82.5 136.5 78" />

        <path class="ev-cat__tail" d="M104 92Q122 85 121 98Q120 108 108 106" />
        <g class="ev-cat__body">
          <ellipse cx="80" cy="96" rx="30" ry="17" />
          <ellipse cx="62" cy="106" rx="11" ry="6.5" />
          <ellipse cx="98" cy="106" rx="11" ry="6.5" />
          <path class="ev-cat__toe" d="M58.5 109V112M62 110V113M65.5 109V112M94.5 109V112M98 110V113M101.5 109V112" />
        </g>

        <g class="ev-cat__idea" aria-hidden="true">
          <circle cx="115" cy="101" r="2" />
          <circle cx="122" cy="98" r="1.5" />
          <circle cx="120" cy="104" r="1.5" />
          <line x1="115" y1="101" x2="122" y2="98" />
          <line x1="115" y1="101" x2="120" y2="104" />
        </g>

        <g class="ev-cat__head">
          <circle cx="80" cy="64" r="24" />
          <polygon points="59,48 64,27 75,45" />
          <polygon class="ev-cat__inner-ear" points="61.5,46 65,33 72,44" />
          <polygon points="85,45 96,27 101,48" />
          <polygon class="ev-cat__inner-ear" points="88,44 95,33 98.5,46" />

          ${sleeping ? html`
            <path class="ev-cat__eye-line" d="M67 64Q73 68.5 79 64" />
            <path class="ev-cat__eye-line" d="M81 64Q87 68.5 93 64" />
          ` : html`
            <ellipse class="ev-cat__eye" cx="72" cy="64" rx="5.5" ry="5" />
            <ellipse class="ev-cat__eye" cx="88" cy="64" rx="5.5" ry="5" />
            <circle class="ev-cat__eye-highlight" cx="73.5" cy="62.5" r="1.8" />
            <circle class="ev-cat__eye-highlight" cx="89.5" cy="62.5" r="1.8" />
          `}

          ${thinking ? html`
            <circle class="ev-cat__thinking-dot ev-cat__thinking-dot--one" cx="70" cy="52" r="3" />
            <circle class="ev-cat__thinking-dot ev-cat__thinking-dot--two" cx="80" cy="48" r="3" />
            <circle class="ev-cat__thinking-dot ev-cat__thinking-dot--three" cx="90" cy="52" r="3" />
          ` : html``}

          <ellipse class="ev-cat__nose" cx="80" cy="72" rx="2.8" ry="2.2" />
          <path class="ev-cat__mouth" d="M80 74.2Q77 77.5 74.5 76.5M80 74.2Q83 77.5 85.5 76.5" />
          <path class="ev-cat__whisker" d="M45 69L67 71.5M45 74.5L67 73.5M93 71.5L115 69M93 73.5L115 74.5" />
        </g>
      </svg>
    `;
  }
}
