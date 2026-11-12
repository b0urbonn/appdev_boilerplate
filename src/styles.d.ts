declare module '*.css';
declare module '*.wav?url' {
  const url: string;
  export default url;
}
