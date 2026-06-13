import { getCurrentUser, getIsAdmin } from "@/app/actions";
import { loadScheduleData } from "@/lib/schedule-data";
import { NameEntryForm } from "./name-entry-form";
import { ScheduleCalendar } from "./schedule-calendar";

type PageProps = {
  searchParams?: Promise<{
    month?: string;
  }>;
};

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="entry-page">
        <section className="entry-panel">
          <p className="eyebrow">Schedule Calendar</p>
          <h1>이름을 입력해주세요</h1>
          <NameEntryForm />
        </section>
      </main>
    );
  }

  const isAdmin = await getIsAdmin();
  const schedule = await loadScheduleData(params?.month, isAdmin);

  return (
    <ScheduleCalendar
      currentUser={{
        id: user.id,
        displayName: user.displayName,
        shortCode: user.shortCode,
      }}
      isAdmin={isAdmin}
      schedule={schedule}
    />
  );
}
