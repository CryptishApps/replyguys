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
    "reply.evaluate-batch": {
        data: {
            reportId: string;
            minLength: number;
            replies: Array<{ replyId: string; text: string }>;
        };
    };
    "report.generate-summary": {
        data: {
            reportId: string;
        };
    };
    "report.generate-viral-tweet": {
        data: {
            reportId: string;
            userId: string;
        };
    };
};

export const inngest = new Inngest({
    id: "replyguys",
    schemas: new EventSchemas().fromRecord<Events>(),
});
