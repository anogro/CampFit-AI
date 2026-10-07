import { describe, expect, it } from "vitest"
import { mapDirectSchoolCatalog } from "@/lib/campfit/v3/directCatalogAdapter"
import { directAgeLabel, directDurationLabel, directPriceLabel, directVerification } from "@/lib/campfit/v3/directCatalogPresentation"
describe("direct catalog presentation", () => {
  const today = "2026-10-07"
  const school = { id: "school-3", slug: "school-three", name: "School", city: "Zurich", country: "CH", status: "published", short_term_confirmed: true, direct_registration_confirmed: true, verified_at: "2026-08-01" }
  it("labels grade without deriving age, and distinguishes attendance from payable weeks", () => {
    const [program] = mapDirectSchoolCatalog([school], [{ id: "o3", school_id: "school-3", name: "Short term", status: "published", offering_type: "schooling", year_levels: ["Year 6"], min_weeks: 3, max_weeks: 4, minimum_payable_weeks: 5 }], [], today)
    expect(directAgeLabel(program!)).toBe("Year 6 · 학년별 확인")
    expect(directDurationLabel(program!)).toBe("참여 3~4주 · 최소 결제 5주")
  })
  it("leaves missing price unknown and renders the fee's unit and applies-to condition", () => {
    const [unknown] = mapDirectSchoolCatalog([school], [{ id: "u", school_id: "school-3", name: "Unknown", status: "published", offering_type: "schooling" }], [], today)
    expect(directPriceLabel(unknown!)).toBe("참가비 확인 필요")
    const [known] = mapDirectSchoolCatalog([school], [{ id: "k", school_id: "school-3", name: "Known", status: "published", offering_type: "schooling", fee_options: [{ amount: 900, currency: "CHF", unit: "per_day", appliesTo: "Year 6" }] }], [], today)
    expect(directPriceLabel(known!)).toBe("CHF 900/일 · 적용 조건 확인")
  })
  it("keeps regular school participation as enquiry-required even with an open dated session", () => {
    const [program] = mapDirectSchoolCatalog([school], [{ id: "o4", school_id: "school-3", name: "Term", status: "published", offering_type: "schooling" }], [{ id: "s4", offering_id: "o4", status: "published", starts_on: "2027-01-01", ends_on: "2027-02-01", availability: "open" }], today)
    expect(directVerification(program!, 3)).toContain("학년·희망기간별 학교 확인 필요")
    expect(program?.sessionVariants?.[0]?.availabilityStatus).toBe("needs_inquiry")
  })
})
