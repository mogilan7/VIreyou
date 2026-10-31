import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import fs from "fs";
import path from "path";
import prisma from "../src/lib/prisma";

const placeholderId = "d2463380-9bd8-47ac-ab31-55b5b8807f6d";
const targetId = "2fe15dcd-a2ad-416e-a7e3-efa7a81750b1";
const userIds = [placeholderId, targetId];

async function main() {
  const backupDir = path.join(process.cwd(), "scripts", "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const backupFilePath = path.join(backupDir, `merge_157526026_${todayStr}.json`);

  console.log(`[BACKUP] Collecting rows for user IDs across all related tables...`);

  const [
    users,
    nutritionLogs,
    activityLogs,
    sleepLogs,
    hydrationLogs,
    habitLogs,
    habitEpisodes,
    biomarkerResults,
    medicalDocuments,
    analyticsEvents,
    transactions,
    assistantMessages,
    topicMentions,
    dailyActionLogs,
    adviceLogs,
    disclosureLogs,
    consultantLogs,
    testResults,
    healthData,
    assistantStates,
    nutrientCalcs,
    domainBaselines,
    engagementStates,
    squadsCreated,
    squadParticipants,
    consultationsClient,
    consultationsSpecialist,
    accessPermissions,
    authUsers
  ] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } } }),
    prisma.nutritionLog.findMany({ where: { user_id: { in: userIds } } }),
    prisma.activityLog.findMany({ where: { user_id: { in: userIds } } }),
    prisma.sleepLog.findMany({ where: { user_id: { in: userIds } } }),
    prisma.hydrationLog.findMany({ where: { user_id: { in: userIds } } }),
    prisma.habitLog.findMany({ where: { user_id: { in: userIds } } }),
    prisma.habitEpisode.findMany({ where: { user_id: { in: userIds } } }),
    prisma.biomarkerResult.findMany({ where: { user_id: { in: userIds } } }),
    prisma.medicalDocument.findMany({ where: { user_id: { in: userIds } } }),
    prisma.analyticsEvent.findMany({ where: { user_id: { in: userIds } } }),
    prisma.transaction.findMany({ where: { user_id: { in: userIds } } }),
    prisma.assistantMessage.findMany({ where: { user_id: { in: userIds } } }),
    prisma.topicMention.findMany({ where: { user_id: { in: userIds } } }),
    prisma.dailyActionLog.findMany({ where: { userId: { in: userIds } } }),
    prisma.adviceLog.findMany({ where: { userId: { in: userIds } } }),
    prisma.disclosureLog.findMany({ where: { userId: { in: userIds } } }),
    prisma.consultantLog.findMany({ where: { userId: { in: userIds } } }),
    prisma.test_results.findMany({ where: { user_id: { in: userIds } } }),
    prisma.healthData.findMany({ where: { user_id: { in: userIds } } }),
    prisma.assistantState.findMany({ where: { userId: { in: userIds } } }),
    prisma.nutrientCalc.findMany({ where: { userId: { in: userIds } } }),
    prisma.domainBaseline.findMany({ where: { userId: { in: userIds } } }),
    prisma.engagementState.findMany({ where: { userId: { in: userIds } } }),
    prisma.squad.findMany({ where: { creator_id: { in: userIds } } }),
    prisma.squadParticipant.findMany({ where: { user_id: { in: userIds } } }),
    prisma.consultation.findMany({ where: { client_id: { in: userIds } } }),
    prisma.consultation.findMany({ where: { specialist_id: { in: userIds } } }),
    prisma.accessPermission.findMany({ where: { user_id: { in: userIds } } }),
    prisma.$queryRawUnsafe(`SELECT * FROM auth.users WHERE id IN ('${placeholderId}', '${targetId}')`)
  ]);

  const backupData = {
    createdAt: new Date().toISOString(),
    placeholderId,
    targetId,
    tables: {
      User: users,
      NutritionLog: nutritionLogs,
      ActivityLog: activityLogs,
      SleepLog: sleepLogs,
      HydrationLog: hydrationLogs,
      HabitLog: habitLogs,
      HabitEpisode: habitEpisodes,
      BiomarkerResult: biomarkerResults,
      MedicalDocument: medicalDocuments,
      AnalyticsEvent: analyticsEvents,
      Transaction: transactions,
      AssistantMessage: assistantMessages,
      TopicMention: topicMentions,
      DailyActionLog: dailyActionLogs,
      AdviceLog: adviceLogs,
      DisclosureLog: disclosureLogs,
      ConsultantLog: consultantLogs,
      test_results: testResults,
      HealthData: healthData,
      AssistantState: assistantStates,
      NutrientCalc: nutrientCalcs,
      DomainBaseline: domainBaselines,
      EngagementState: engagementStates,
      Squad_created: squadsCreated,
      SquadParticipant: squadParticipants,
      Consultation_client: consultationsClient,
      Consultation_specialist: consultationsSpecialist,
      AccessPermission: accessPermissions,
      auth_users: authUsers
    }
  };

  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), "utf8");

  const stat = fs.statSync(backupFilePath);
  console.log(`[BACKUP] ✅ Backup file created successfully.`);
  console.log(`[BACKUP] File path: ${backupFilePath}`);
  console.log(`[BACKUP] File size: ${(stat.size / 1024).toFixed(2)} KB`);

  console.log(`[BACKUP] Table row counts in backup:`);
  for (const [table, rows] of Object.entries(backupData.tables)) {
    console.log(`  - ${table}: ${(rows as any[]).length} rows`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
