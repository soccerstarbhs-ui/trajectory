"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CourseStatus = "planned" | "in_progress" | "completed";
type ActivityStatus = "planned" | "active" | "completed";
type ActivityCategory = "extracurricular" | "clinical" | "volunteering" | "leadership" | "research" | "other";

type BasicProfile = {
  major: string;
  gpa: string;
  graduationDate: string;
  applicationCycle: string;
};

type Course = {
  id: string;
  name: string;
  status: CourseStatus;
  term: string;
  grade: string;
};

type Activity = {
  id: string;
  category: ActivityCategory;
  name: string;
  role: string;
  status: ActivityStatus;
  startDate: string;
  endDate: string;
  hours: string;
  description: string;
};

const storageKey = "trajectory-applicant-profile-v1";
const emptyBasic: BasicProfile = { major: "", gpa: "", graduationDate: "", applicationCycle: "" };
const emptyCourse: Omit<Course, "id"> = { name: "", status: "planned", term: "", grade: "" };
const emptyActivity: Omit<Activity, "id"> = {
  category: "extracurricular",
  name: "",
  role: "",
  status: "planned",
  startDate: "",
  endDate: "",
  hours: "",
  description: "",
};

const categoryLabels: Record<ActivityCategory, string> = {
  extracurricular: "Extracurricular",
  clinical: "Clinical experience",
  volunteering: "Volunteering",
  leadership: "Leadership",
  research: "Research",
  other: "Other activity",
};

const statusLabels: Record<CourseStatus | ActivityStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  active: "Active",
  completed: "Completed",
};

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export function ApplicantProfileForm() {
  const [basic, setBasic] = useState<BasicProfile>(emptyBasic);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [courseDraft, setCourseDraft] = useState(emptyCourse);
  const [activityDraft, setActivityDraft] = useState(emptyActivity);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [courseError, setCourseError] = useState("");
  const [activityError, setActivityError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return;

      try {
        const profile = JSON.parse(stored) as {
          basic?: BasicProfile;
          courses?: Course[];
          activities?: Activity[];
        };
        if (profile.basic) setBasic(profile.basic);
        if (profile.courses) setCourses(profile.courses);
        if (profile.activities) setActivities(profile.activities);
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const totalHours = useMemo(
    () => activities.reduce((sum, activity) => sum + (Number(activity.hours) || 0), 0),
    [activities]
  );

  const categoryCounts = useMemo(
    () => activities.reduce<Partial<Record<ActivityCategory, number>>>((counts, activity) => {
      counts[activity.category] = (counts[activity.category] ?? 0) + 1;
      return counts;
    }, {}),
    [activities]
  );

  function updateBasic(field: keyof BasicProfile, value: string) {
    setBasic((current) => ({ ...current, [field]: value }));
    setSaved(false);
  }

  function saveCourse() {
    if (!courseDraft.name.trim()) {
      setCourseError("Add a course name before saving.");
      return;
    }

    if (editingCourseId) {
      setCourses((current) => current.map((course) =>
        course.id === editingCourseId ? { ...courseDraft, id: editingCourseId } : course
      ));
    } else {
      setCourses((current) => [...current, { ...courseDraft, id: newId() }]);
    }

    setCourseDraft(emptyCourse);
    setEditingCourseId(null);
    setCourseError("");
    setSaved(false);
  }

  function editCourse(course: Course) {
    const { id, ...draft } = course;
    setCourseDraft(draft);
    setEditingCourseId(id);
    setCourseError("");
  }

  function removeCourse(id: string) {
    setCourses((current) => current.filter((course) => course.id !== id));
    if (editingCourseId === id) {
      setCourseDraft(emptyCourse);
      setEditingCourseId(null);
    }
    setSaved(false);
  }

  function saveActivity() {
    if (!activityDraft.name.trim() || !activityDraft.role.trim()) {
      setActivityError("Add both an activity name and your role before saving.");
      return;
    }

    if (editingActivityId) {
      setActivities((current) => current.map((activity) =>
        activity.id === editingActivityId ? { ...activityDraft, id: editingActivityId } : activity
      ));
    } else {
      setActivities((current) => [...current, { ...activityDraft, id: newId() }]);
    }

    setActivityDraft(emptyActivity);
    setEditingActivityId(null);
    setActivityError("");
    setSaved(false);
  }

  function editActivity(activity: Activity) {
    const { id, ...draft } = activity;
    setActivityDraft(draft);
    setEditingActivityId(id);
    setActivityError("");
  }

  function removeActivity(id: string) {
    setActivities((current) => current.filter((activity) => activity.id !== id));
    if (editingActivityId === id) {
      setActivityDraft(emptyActivity);
      setEditingActivityId(null);
    }
    setSaved(false);
  }

  function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.localStorage.setItem(storageKey, JSON.stringify({ basic, courses, activities }));
    setSaved(true);
  }

  return (
    <main className="profile-page">
      <div className="profile-page__glow" aria-hidden="true" />
      <header className="profile-nav">
        <Link href="/" className="orbit-brand" aria-label="Return to destinations">
          <span className="orbit-brand__mark" aria-hidden="true"><i /></span>
          TRAJECTORY
        </Link>
        <span>MEDICAL SCHOOL · APPLICANT PROFILE</span>
      </header>

      <section className="profile-heading">
        <div>
          <p>STEP 01 · YOUR BACKGROUND</p>
          <h1>Show us where you are now.</h1>
        </div>
        <p>Add your academics and experiences. Everything stays editable before Trajectory uses it to identify gaps and map your next moves.</p>
      </section>

      <form className="profile-layout" onSubmit={saveProfile}>
        <div className="profile-form-column">
          <section className="profile-section">
            <SectionHeading number="01" title="Academic foundation" detail="The timeline and academic context for your path." />
            <div className="profile-field-grid">
              <Field label="Major"><input required value={basic.major} onChange={(event) => updateBasic("major", event.target.value)} placeholder="Biomedical Engineering" /></Field>
              <Field label="Current GPA"><input required inputMode="decimal" value={basic.gpa} onChange={(event) => updateBasic("gpa", event.target.value)} placeholder="3.82" pattern="^(4(?:\.0{1,2})?|[0-3](?:\.\d{1,2})?)$" title="Enter a GPA from 0.00 to 4.00" /></Field>
              <Field label="Graduation date"><input required type="month" value={basic.graduationDate} onChange={(event) => updateBasic("graduationDate", event.target.value)} /></Field>
              <Field label="Intended application cycle">
                <select required value={basic.applicationCycle} onChange={(event) => updateBasic("applicationCycle", event.target.value)}>
                  <option value="">Select a cycle</option>
                  {["2026–2027", "2027–2028", "2028–2029", "2029–2030", "2030–2031", "Undecided"].map((cycle) => <option key={cycle} value={cycle}>{cycle}</option>)}
                </select>
              </Field>
            </div>
          </section>

          <section className="profile-section">
            <SectionHeading number="02" title="Coursework" detail="Add completed, current, or planned courses that shape your route." />
            {courses.length > 0 ? (
              <div className="profile-record-list">
                {courses.map((course) => (
                  <article className="profile-record" key={course.id}>
                    <div><small>{statusLabels[course.status]}</small><strong>{course.name}</strong><p>{[course.term, course.grade && `Grade ${course.grade}`].filter(Boolean).join(" · ") || "Details not added"}</p></div>
                    <RecordActions onEdit={() => editCourse(course)} onRemove={() => removeCourse(course.id)} />
                  </article>
                ))}
              </div>
            ) : <p className="profile-empty">No coursework added yet.</p>}

            <div className="profile-editor">
              <EditorTitle title={editingCourseId ? "Edit coursework" : "Add coursework"} editing={Boolean(editingCourseId)} onCancel={() => { setEditingCourseId(null); setCourseDraft(emptyCourse); }} />
              <div className="profile-field-grid profile-field-grid--course">
                <Field label="Course name"><input value={courseDraft.name} onChange={(event) => setCourseDraft({ ...courseDraft, name: event.target.value })} placeholder="Organic Chemistry I" /></Field>
                <Field label="Status"><select value={courseDraft.status} onChange={(event) => setCourseDraft({ ...courseDraft, status: event.target.value as CourseStatus })}><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></Field>
                <Field label="Term"><input value={courseDraft.term} onChange={(event) => setCourseDraft({ ...courseDraft, term: event.target.value })} placeholder="Fall 2026" /></Field>
                <Field label="Grade"><input value={courseDraft.grade} onChange={(event) => setCourseDraft({ ...courseDraft, grade: event.target.value })} placeholder="A or in progress" /></Field>
              </div>
              {courseError ? <p className="profile-editor__error">{courseError}</p> : null}
              <button className="profile-add-button" type="button" onClick={saveCourse}>{editingCourseId ? "Save changes" : "+ Add course"}</button>
            </div>
          </section>

          <section className="profile-section">
            <SectionHeading number="03" title="Experiences and activities" detail="Clinical work, service, leadership, research, and everything else that matters." />
            {activities.length > 0 ? (
              <div className="profile-record-list">
                {activities.map((activity) => (
                  <article className="profile-record profile-record--activity" key={activity.id}>
                    <div><small>{categoryLabels[activity.category]} · {statusLabels[activity.status]}</small><strong>{activity.name}</strong><p>{activity.role}{activity.hours ? ` · ${activity.hours} hours` : ""}</p></div>
                    <RecordActions onEdit={() => editActivity(activity)} onRemove={() => removeActivity(activity.id)} />
                  </article>
                ))}
              </div>
            ) : <p className="profile-empty">No experiences added yet.</p>}

            <div className="profile-editor">
              <EditorTitle title={editingActivityId ? "Edit activity" : "Add an activity"} editing={Boolean(editingActivityId)} onCancel={() => { setEditingActivityId(null); setActivityDraft(emptyActivity); }} />
              <div className="profile-field-grid">
                <Field label="Category"><select value={activityDraft.category} onChange={(event) => setActivityDraft({ ...activityDraft, category: event.target.value as ActivityCategory })}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                <Field label="Activity or organization"><input value={activityDraft.name} onChange={(event) => setActivityDraft({ ...activityDraft, name: event.target.value })} placeholder="Emergency Department volunteer" /></Field>
                <Field label="Your role"><input value={activityDraft.role} onChange={(event) => setActivityDraft({ ...activityDraft, role: event.target.value })} placeholder="Volunteer" /></Field>
                <Field label="Status"><select value={activityDraft.status} onChange={(event) => setActivityDraft({ ...activityDraft, status: event.target.value as ActivityStatus })}><option value="planned">Planned</option><option value="active">Active</option><option value="completed">Completed</option></select></Field>
                <Field label="Start date"><input type="month" value={activityDraft.startDate} onChange={(event) => setActivityDraft({ ...activityDraft, startDate: event.target.value })} /></Field>
                <Field label="End date"><input type="month" value={activityDraft.endDate} onChange={(event) => setActivityDraft({ ...activityDraft, endDate: event.target.value })} /></Field>
                <Field label="Total hours"><input type="number" min="0" value={activityDraft.hours} onChange={(event) => setActivityDraft({ ...activityDraft, hours: event.target.value })} placeholder="120" /></Field>
                <Field label="Description" wide><textarea rows={4} value={activityDraft.description} onChange={(event) => setActivityDraft({ ...activityDraft, description: event.target.value })} placeholder="What did you do, who did it serve, and what responsibility did you hold?" /></Field>
              </div>
              {activityError ? <p className="profile-editor__error">{activityError}</p> : null}
              <button className="profile-add-button" type="button" onClick={saveActivity}>{editingActivityId ? "Save changes" : "+ Add activity"}</button>
            </div>
          </section>
        </div>

        <aside className="profile-summary">
          <p>PROFILE SNAPSHOT</p>
          <h2>{basic.major || "Your applicant profile"}</h2>
          <div className="profile-summary__stats">
            <span><strong>{courses.length}</strong> courses</span>
            <span><strong>{activities.length}</strong> activities</span>
            <span><strong>{totalHours.toLocaleString()}</strong> total hours</span>
          </div>
          <div className="profile-summary__coverage">
            <span>Experience coverage</span>
            {(Object.keys(categoryLabels) as ActivityCategory[]).map((category) => (
              <div key={category} data-filled={Boolean(categoryCounts[category])}><i /><span>{categoryLabels[category]}</span><strong>{categoryCounts[category] ?? 0}</strong></div>
            ))}
          </div>
          <button className="profile-save" type="submit">Save applicant profile <span>→</span></button>
          {saved ? <p className="profile-saved" role="status">Profile saved. Gap analysis comes next.</p> : <small>Your information is saved in this browser for the MVP.</small>}
        </aside>
      </form>
    </main>
  );
}

function SectionHeading({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <div className="profile-section__heading"><span>{number}</span><div><h2>{title}</h2><p>{detail}</p></div></div>;
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={wide ? "profile-field--wide" : undefined}><span>{label}</span>{children}</label>;
}

function RecordActions({ onEdit, onRemove }: { onEdit: () => void; onRemove: () => void }) {
  return <div className="profile-record__actions"><button type="button" onClick={onEdit}>Edit</button><button type="button" onClick={onRemove}>Remove</button></div>;
}

function EditorTitle({ title, editing, onCancel }: { title: string; editing: boolean; onCancel: () => void }) {
  return <div className="profile-editor__title"><strong>{title}</strong>{editing ? <button type="button" onClick={onCancel}>Cancel</button> : null}</div>;
}
