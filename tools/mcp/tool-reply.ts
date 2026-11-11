/** What a tool function returns: the text for the agent, and whether the call itself was wrong. */
export interface ToolReply {
  readonly text: string;
  readonly isError: boolean;
}
