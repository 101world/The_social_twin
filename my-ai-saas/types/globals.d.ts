// Custom element typings and ambient module shims

// Allow using the <model-viewer> web component in TSX without JSX errors
declare namespace JSX {
  interface IntrinsicElements {
    'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      src?: string;
      poster?: string;
      'camera-controls'?: boolean;
      autoplay?: boolean;
      exposure?: string | number;
      'shadow-intensity'?: string | number;
      style?: React.CSSProperties;
      [key: string]: any;
    };
  }
}

// pdfkit lacks bundled types in some versions; provide a minimal shim
declare module 'pdfkit' {
  const PDFDocument: any;
  export default PDFDocument;
}
