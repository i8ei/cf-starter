export type JobMessage =
  | {
      type: "user.welcome";
      payload: {
        userId: string;
        email: string;
        name: string;
        requestId: string;
      };
    }
  | {
      type: "upload.process";
      payload: {
        key: string;
        organizationId: string;
        size: number;
        contentType: string | null;
        requestId: string;
      };
    }
  | {
      type: "organization.invite_email";
      payload: {
        organizationId: string;
        organizationName: string;
        inviteId: string;
        email: string;
        role: string;
        inviteUrl: string;
        requestId: string;
      };
    };
