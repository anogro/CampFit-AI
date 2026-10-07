import { describe, expect, it } from "vitest"
import { mapDirectActivityCatalog, mapDirectSchoolCatalog } from "@/lib/campfit/v3/directCatalogAdapter"
describe("direct catalog adapters", () => {
  const today = "2026-10-07"
  it("gates camp visibility, removes past offerings and keeps a closed future camp closed", () => {
    const camp = { id: "same-id", official_name: "City Camp", city: "Toronto", country_code: "CA", is_published: true, review_status: "verified", visitor_eligibility: "unknown", direct_registration_status: "unknown" }
    const rows = mapDirectActivityCatalog([camp], [
      { id: "past", camp_id: "same-id", schedule_status: "announced", date_scope: "session", start_date: "2025-07-01", end_date: "2025-07-14", registration_status: "closed" },
      { id: "future", camp_id: "same-id", schedule_status: "announced", date_scope: "session", start_date: "2027-07-01", end_date: "2027-07-14", registration_status: "closed" },
    ], today)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.sessionVariants?.map(x => x.availabilityStatus)).toEqual(["closed"])
    expect(rows[0]?.directCatalog).toMatchObject({ sourceKind: "program", sourceId: "same-id", detailPath: "/program/local/same-id" })
    expect(mapDirectActivityCatalog([{ ...camp, is_published: false }], [], today)).toEqual([])
    expect(mapDirectActivityCatalog([{ ...camp, review_status: "needs_review" }], [], today)).toEqual([])
  })
  it("requires school publication gates and does not treat open school sessions as inventory", () => {
    const school = { id: "school-1", slug: "school-one", name: "School", city: "Auckland", country: "NZ", status: "published", short_term_confirmed: true, direct_registration_confirmed: true, verified_at: "2026-08-01" }
    const rows = mapDirectSchoolCatalog([school], [
      { id: "regular", school_id: "school-1", name: "Regular schooling", offering_type: "schooling", status: "published" },
      { id: "private", school_id: "school-1", name: "Draft", offering_type: "schooling", status: "draft" },
    ], [
      { id: "open", offering_id: "regular", status: "published", starts_on: "2027-01-10", ends_on: "2027-02-07", availability: "open" },
      { id: "draft", offering_id: "regular", status: "draft", starts_on: "2027-03-01", ends_on: "2027-03-20", availability: "open" },
    ], today)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.directCatalog.availabilityMode).toBe("enquiry_required")
    expect(rows[0]?.sessionVariants?.map(x => x.availabilityStatus)).toEqual(["needs_inquiry"])
    expect(rows[0]?.directCatalog).toMatchObject({ sourceId: "school-1", sourceOfferingId: "regular", detailPath: "/schools/school-one" })
    expect(mapDirectSchoolCatalog([{ ...school, verified_at: null }], [{ id: "x", school_id: "school-1", name: "Regular", status: "published" }], [], today)).toEqual([])
  })
  it("keeps unknown age and cost null, grade separate, payable weeks distinct and fee camelCase/unit exact", () => {
    const school = { id: "school-2", name: "School", city: "Singapore", country: "SG", status: "published", short_term_confirmed: true, direct_registration_confirmed: true, verified_at: "2026-08-01" }
    const [program] = mapDirectSchoolCatalog([school], [{ id: "offering-2", school_id: "school-2", name: "Term", offering_type: "schooling", status: "published", year_levels: ["Year 5"], min_weeks: 2, max_weeks: 4, minimum_payable_weeks: 5, fee_options: [{ amount: 1200, currency: "SGD", unit: "per_week", periodWeeks: 3, priceYear: 2027, appliesTo: "Year 5", notes: "Tuition only" }] }], [], today)
    expect(program?.ageMin).toBeNull()
    expect(program?.ageMax).toBeNull()
    expect(program?.directCatalog.yearLevels).toEqual(["Year 5"])
    expect(program?.durationWeeks).toEqual([2, 3, 4])
    expect(program?.directCatalog).toMatchObject({ minAttendanceWeeks: 2, maxAttendanceWeeks: 4, minPayableWeeks: 5 })
    expect(program?.directCatalog.fees).toEqual([{ amount: 1200, currency: "SGD", unit: "per_week", periodWeeks: 3, priceYear: 2027, appliesTo: "Year 5", notes: "Tuition only" }])
    expect(program?.budgetMinKrw).toBeNull()
    expect(program?.budgetMaxKrw).toBeNull()
    expect(program?.priceOptions).toEqual([])
  })
})
