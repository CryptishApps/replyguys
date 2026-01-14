import { Inngest, EventSchemas } from "inngest";

type Events = {
    "report.created": {
        data: {
            reportId: string;
            conversationId: string;
        };
    };
    "report.scrape.recurring": {
        data: {
            reportId: string;
            conversationId: string;
        };
    };
    "reply.evaluate": {
        data: {
            replyId: string;
            reportId: string;
            text: string;
            minLength: number;
        };
    };
};

export const inngest = new Inngest({
    id: "replyguys",
    schemas: new EventSchemas().fromRecord<Events>(),
});
