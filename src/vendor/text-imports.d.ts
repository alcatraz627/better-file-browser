// A stylesheet imported as its text (build.ts loads .css files as text).
declare module '*.css' {
  const text: string;
  export default text;
}
