export enum Role {
  system = "system",
  user = "user",
  assistant = "assistant",
}

type Message = {
  role: Role;
  content: string;
};
