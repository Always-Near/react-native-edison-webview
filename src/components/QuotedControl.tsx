import React from "react";
import QuotedHTMLTransformer from "../utils/quoted-html-transformer";

type Props = {
  html: string;
  onClick: () => void;
};

class QuotedControl extends React.Component<Props> {
  shouldComponentUpdate(nextProps: Props) {
    return this.props.html !== nextProps.html;
  }

  render() {
    if (!QuotedHTMLTransformer.hasQuotedHTML(this.props.html)) {
      return null;
    }

    return (
      <div className="quoted-btn" onClick={this.props.onClick}>
        <svg
          id="_..._more_less"
          data-name="... more/less"
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="12"
          viewBox="0 0 32 12"
        >
          <rect
            id="矩形_768"
            data-name="矩形 768"
            width="32"
            height="12"
            rx="6"
            fill="#ebebeb"
          />
          <circle
            id="椭圆_196"
            data-name="椭圆 196"
            cx="2"
            cy="2"
            r="2"
            transform="translate(14 4)"
            fill="#666"
          />
          <circle
            id="椭圆_198"
            data-name="椭圆 198"
            cx="2"
            cy="2"
            r="2"
            transform="translate(20 4)"
            fill="#666"
          />
          <circle
            id="椭圆_197"
            data-name="椭圆 197"
            cx="2"
            cy="2"
            r="2"
            transform="translate(8 4)"
            fill="#666"
          />
        </svg>
      </div>
    );
  }
}

export default QuotedControl;
