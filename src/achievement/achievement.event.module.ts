import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AchievementProgress, AchievementProgressSchema } from "src/schemas/achievement-progress.schema";
import { Achievement, AchievementSchema } from "src/schemas/achievement.schema";
import { AchievementEventListener } from "./events/achievement.event.listener";

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Achievement.name, schema: AchievementSchema },
            { name: AchievementProgress.name, schema: AchievementProgressSchema },
        ]),
    ],
    providers: [AchievementEventListener],
    exports: [AchievementEventListener],
})
export class AchievementEventModule { }
