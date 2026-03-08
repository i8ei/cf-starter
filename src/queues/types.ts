export type JobMessage =
  | {
      type: "user.welcome";
      payload: {
        userId: number;
        email: string;
        name: string;
        requestId: string;
      };
    }
  | {
      type: "upload.process";
      payload: {
        key: string;
        size: number;
        contentType: string | null;
        requestId: string;
      };
    };
