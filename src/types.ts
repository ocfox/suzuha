export enum Role {
  system = "system",
  user = "user",
  assistant = "assistant",
}

export type Message = {
  role: Role;
  content: string;
};
