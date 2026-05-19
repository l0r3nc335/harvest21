"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Radio } from "@/components/ui/Radio";
import { Autocomplete } from "@/components/ui/Autocomplete";
import { ChurchAffiliationSelector } from "@/components/ChurchAffiliationSelector";
import { PayoutSetupSection } from "@/components/settings/PayoutSetupSection";
import toast from "react-hot-toast";
import type { UpdateMissionaryDetailsData } from "@/app/admin/missionaries/[id]/actions";
import { updateDonationOptions } from "@/app/settings/actions";
import { countryList, getCountryNameFromISO, getISOFromCountryName } from "@/lib/countryHelpers";
import { 
  searchAgencies, 
  searchChurches, 
  getInitialAgencies,
  getInitialChurches,
} from "@/app/admin/missionaries/actions";

type MissionaryDetailData = {
  id: number;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  country_of_residence: string | null;
  destination_country: string;
  mission_status: string;
  open_to_visits: boolean;
  visits_start_date?: string | null;
  visits_end_date?: string | null;
  agency_id: number | null;
  sending_church_id: number | null;
  mission_field_church_id: number | null;
  created_at: string;
  agency?: {
    id: number;
    name: string;
  } | null;
  sendingChurch?: {
    id: number;
    name: string;
  } | null;
  missionFieldChurch?: {
    id: number;
    name: string;
  } | null;
  page?: {
    id: number;
    donation_percentage: number | null;
    donation_mode: "harvest21" | "external" | "off" | null;
    external_donation_url: string | null;
  } | null;
};

type MissionaryAccountBasicsTabProps = {
  missionary: MissionaryDetailData;
  pageId?: number | null;
  isAdmin?: boolean;
  onChurchAffiliationChange?: () => void;
  onSendInvite?: (data: { email: string; firstName: string; lastName: string }) => Promise<{ success: boolean; message?: string }>;
  onUpdateMissionary: (
    missionaryId: number,
    data: UpdateMissionaryDetailsData,
    originalFirstName: string,
    originalLastName: string
  ) => Promise<{ success: boolean; message?: string; data?: unknown }>;
};

// Map mission_status from database to UI format
const mapMissionStatusToUI = (status: string): string => {
  if (status === "On-Field") return "On-field";
  if (status === "Furlough") return "Furlough";
  if (status === "Deputation") return "Deputation";
  return status;
};

// Map mission_status from UI to database format
const mapMissionStatusToDB = (status: string): string => {
  if (status === "On-field") return "On-Field";
  return status;
};

export function MissionaryAccountBasicsTab({ 
  missionary, 
  pageId: pageIdProp,
  isAdmin = false,
  onChurchAffiliationChange,
  onSendInvite,
  onUpdateMissionary 
}: MissionaryAccountBasicsTabProps) {
  const router = useRouter();
  const effectivePageId = missionary.page?.id ?? pageIdProp ?? null;
  const [profileInfo, setProfileInfo] = useState({
    firstName: missionary.first_name || "",
    lastName: missionary.last_name || "",
    email: missionary.email || "",
    phoneNumber: missionary.phone_number || "",
    countryOfResidence: getCountryNameFromISO(missionary.country_of_residence) || "",
  });

  const [affiliationInfo, setAffiliationInfo] = useState({
    agencyId: missionary.agency_id,
    sendingChurchId: missionary.sending_church_id,
    missionFieldChurchId: missionary.mission_field_church_id,
    missionStatus: mapMissionStatusToUI(missionary.mission_status || ""),
    openToVisits: missionary.open_to_visits || false,
    visitsStartDate: missionary.visits_start_date ?? "",
    visitsEndDate: missionary.visits_end_date ?? "",
    destinationCountry: getCountryNameFromISO(missionary.destination_country) || "",
  });

  const [selectedAgencyName, setSelectedAgencyName] = useState(missionary.agency?.name || "");
  const [selectedSendingChurchName, setSelectedSendingChurchName] = useState(missionary.sendingChurch?.name || "");
  const [selectedMissionFieldChurchName, setSelectedMissionFieldChurchName] = useState(missionary.missionFieldChurch?.name || "");

  const [agencyOptions, setAgencyOptions] = useState<{ id: string | number; name: string }[]>([]);
  const [sendingChurchOptions, setSendingChurchOptions] = useState<{ id: string | number; name: string }[]>([]);
  const [missionFieldChurchOptions, setMissionFieldChurchOptions] = useState<{ id: string | number; name: string }[]>([]);
  const [isLoadingAgencies, setIsLoadingAgencies] = useState(false);
  const [isLoadingSendingChurches, setIsLoadingSendingChurches] = useState(false);
  const [isLoadingMissionFieldChurches, setIsLoadingMissionFieldChurches] = useState(false);

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingAffiliation, setIsSavingAffiliation] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const isManagedNoAccount = missionary.user_id == null;

  const [donationMode, setDonationMode] = useState<"harvest21" | "external" | "off">(
    (missionary.page?.donation_mode as "harvest21" | "external" | "off") ?? "off"
  );
  const [externalDonationUrl, setExternalDonationUrl] = useState(
    missionary.page?.external_donation_url ?? ""
  );
  const [isSavingDonationOptions, setIsSavingDonationOptions] = useState(false);

  // Sync state when missionary prop changes
  useEffect(() => {
    setProfileInfo({
      firstName: missionary.first_name || "",
      lastName: missionary.last_name || "",
      email: missionary.email || "",
      phoneNumber: missionary.phone_number || "",
      countryOfResidence: getCountryNameFromISO(missionary.country_of_residence) || "",
    });

    setAffiliationInfo({
      agencyId: missionary.agency_id,
      sendingChurchId: missionary.sending_church_id,
      missionFieldChurchId: missionary.mission_field_church_id,
      missionStatus: mapMissionStatusToUI(missionary.mission_status || ""),
      openToVisits: missionary.open_to_visits || false,
      visitsStartDate: missionary.visits_start_date ?? "",
      visitsEndDate: missionary.visits_end_date ?? "",
      destinationCountry: getCountryNameFromISO(missionary.destination_country) || "",
    });

    setSelectedAgencyName(missionary.agency?.name || "");
    setSelectedSendingChurchName(missionary.sendingChurch?.name || "");
    setSelectedMissionFieldChurchName(missionary.missionFieldChurch?.name || "");
  }, [missionary]);

  useEffect(() => {
    const fetchInitialOptions = async () => {
      if (isAdmin) {
        const [agencies, churches] = await Promise.all([
          getInitialAgencies(),
          getInitialChurches(),
        ]);
        setAgencyOptions(agencies);
        setSendingChurchOptions(churches);
        setMissionFieldChurchOptions(churches);
      }
    };
    fetchInitialOptions();
  }, [isAdmin]);

  const handleAgencySearch = async (query: string) => {
    setIsLoadingAgencies(true);
    try {
      const results = query.trim() === "" 
        ? await getInitialAgencies()
        : await searchAgencies(query);
      setAgencyOptions(results);
    } catch (error) {
      console.error("Error searching agencies:", error);
    } finally {
      setIsLoadingAgencies(false);
    }
  };

  const handleSendingChurchSearch = async (query: string) => {
    setIsLoadingSendingChurches(true);
    try {
      const results = query.trim() === "" 
        ? await getInitialChurches()
        : await searchChurches(query);
      setSendingChurchOptions(results);
    } catch (error) {
      console.error("Error searching sending churches:", error);
    } finally {
      setIsLoadingSendingChurches(false);
    }
  };

  const handleMissionFieldChurchSearch = async (query: string) => {
    setIsLoadingMissionFieldChurches(true);
    try {
      const results = query.trim() === "" 
        ? await getInitialChurches()
        : await searchChurches(query);
      setMissionFieldChurchOptions(results);
    } catch (error) {
      console.error("Error searching mission field churches:", error);
    } finally {
      setIsLoadingMissionFieldChurches(false);
    }
  };

  const handleSendInvite = async () => {
    if (!onSendInvite || !isManagedNoAccount) return;
    if (!profileInfo.firstName?.trim() || !profileInfo.lastName?.trim()) {
      toast.error("First name and last name are required");
      return;
    }
    if (!profileInfo.email?.trim()) {
      toast.error("Email is required to send invite");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profileInfo.email)) {
      toast.error("Invalid email format");
      return;
    }
    setIsSendingInvite(true);
    try {
      const result = await onSendInvite({
        email: profileInfo.email.trim(),
        firstName: profileInfo.firstName.trim(),
        lastName: profileInfo.lastName.trim(),
      });
      if (result.success) {
        toast.success(result.message ?? "Invite sent");
        router.refresh();
      } else {
        toast.error(result.message || "Failed to send invite");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleSaveProfile = async () => {
    if (isManagedNoAccount) return;
    if (!profileInfo.firstName || profileInfo.firstName.trim() === "") {
      toast.error("First name is required");
      return;
    }
    if (!profileInfo.lastName || profileInfo.lastName.trim() === "") {
      toast.error("Last name is required");
      return;
    }
    if (!profileInfo.email || profileInfo.email.trim() === "") {
      toast.error("Email is required");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profileInfo.email)) {
      toast.error("Invalid email format");
      return;
    }
    if (affiliationInfo.openToVisits) {
      if (!affiliationInfo.visitsStartDate?.trim() || !affiliationInfo.visitsEndDate?.trim()) {
        toast.error("Start date and end date are required when Open to Visits is Yes.");
        return;
      }
      const start = new Date(affiliationInfo.visitsStartDate.trim());
      const end = new Date(affiliationInfo.visitsEndDate.trim());
      if (end < start) {
        toast.error("End date must be the same as or later than start date.");
        return;
      }
    }

    setIsSavingProfile(true);
    try {
      const result = await onUpdateMissionary(
        missionary.id,
        {
          firstName: profileInfo.firstName.trim(),
          lastName: profileInfo.lastName.trim(),
          email: profileInfo.email.trim(),
          phoneNumber: profileInfo.phoneNumber || undefined,
          countryOfResidence: getISOFromCountryName(profileInfo.countryOfResidence) || profileInfo.countryOfResidence || undefined,
          destinationCountry: getISOFromCountryName(affiliationInfo.destinationCountry) || affiliationInfo.destinationCountry,
          missionStatus: mapMissionStatusToDB(affiliationInfo.missionStatus),
          openToVisits: affiliationInfo.openToVisits,
          visitsStartDate: affiliationInfo.openToVisits && affiliationInfo.visitsStartDate?.trim() ? affiliationInfo.visitsStartDate.trim() : null,
          visitsEndDate: affiliationInfo.openToVisits && affiliationInfo.visitsEndDate?.trim() ? affiliationInfo.visitsEndDate.trim() : null,
          agencyId: affiliationInfo.agencyId || null,
          sendingChurchId: affiliationInfo.sendingChurchId || null,
          missionFieldChurchId: affiliationInfo.missionFieldChurchId || null,
        },
        missionary.first_name || "",
        missionary.last_name || ""
      );

      if (result.success) {
        toast.success(result.message || "Profile information saved successfully!");
        if (result.data) {
          const updated = result.data as MissionaryDetailData;
          setProfileInfo({
            firstName: updated.first_name || profileInfo.firstName,
            lastName: updated.last_name || profileInfo.lastName,
            email: updated.email || profileInfo.email,
            phoneNumber: updated.phone_number || profileInfo.phoneNumber,
            countryOfResidence: getCountryNameFromISO(updated.country_of_residence) || profileInfo.countryOfResidence,
          });
        }
      } else {
        toast.error(result.message || "Failed to save profile information");
      }
    } catch (error) {
      console.error("Error saving profile info:", error);
      toast.error("An error occurred while saving");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveAffiliation = async () => {
    // Validate required fields
    if (!affiliationInfo.destinationCountry || affiliationInfo.destinationCountry.trim() === "") {
      toast.error("Destination country is required");
      return;
    }
    if (!affiliationInfo.missionStatus || affiliationInfo.missionStatus.trim() === "") {
      toast.error("Mission status is required");
      return;
    }
    if (affiliationInfo.openToVisits) {
      if (!affiliationInfo.visitsStartDate?.trim() || !affiliationInfo.visitsEndDate?.trim()) {
        toast.error("Start date and end date are required when Open to Visits is Yes.");
        return;
      }
      const start = new Date(affiliationInfo.visitsStartDate.trim());
      const end = new Date(affiliationInfo.visitsEndDate.trim());
      if (end < start) {
        toast.error("End date must be the same as or later than start date.");
        return;
      }
    }

    setIsSavingAffiliation(true);
    try {
      const result = await onUpdateMissionary(
        missionary.id,
        {
          firstName: profileInfo.firstName.trim(),
          lastName: profileInfo.lastName.trim(),
          email: profileInfo.email.trim(),
          phoneNumber: profileInfo.phoneNumber || undefined,
          countryOfResidence: getISOFromCountryName(profileInfo.countryOfResidence) || profileInfo.countryOfResidence || undefined,
          destinationCountry: getISOFromCountryName(affiliationInfo.destinationCountry) || affiliationInfo.destinationCountry,
          missionStatus: mapMissionStatusToDB(affiliationInfo.missionStatus),
          openToVisits: affiliationInfo.openToVisits,
          visitsStartDate: affiliationInfo.openToVisits && affiliationInfo.visitsStartDate?.trim() ? affiliationInfo.visitsStartDate.trim() : null,
          visitsEndDate: affiliationInfo.openToVisits && affiliationInfo.visitsEndDate?.trim() ? affiliationInfo.visitsEndDate.trim() : null,
          agencyId: affiliationInfo.agencyId || null,
          sendingChurchId: affiliationInfo.sendingChurchId || null,
          missionFieldChurchId: affiliationInfo.missionFieldChurchId || null,
        },
        missionary.first_name || "",
        missionary.last_name || ""
      );

      if (result.success) {
        toast.success(result.message || "Affiliation information saved successfully!");
        if (result.data) {
          const updated = result.data as MissionaryDetailData;
          setAffiliationInfo({
            agencyId: updated.agency_id || affiliationInfo.agencyId,
            sendingChurchId: updated.sending_church_id || affiliationInfo.sendingChurchId,
            missionFieldChurchId: updated.mission_field_church_id || affiliationInfo.missionFieldChurchId,
            missionStatus: mapMissionStatusToUI(updated.mission_status || ""),
            openToVisits: updated.open_to_visits || affiliationInfo.openToVisits,
            visitsStartDate: updated.visits_start_date ?? "",
            visitsEndDate: updated.visits_end_date ?? "",
            destinationCountry: getCountryNameFromISO(updated.destination_country) || affiliationInfo.destinationCountry,
          });
        }
      } else {
        toast.error(result.message || "Failed to save affiliation information");
      }
    } catch (error) {
      console.error("Error saving affiliation info:", error);
      toast.error("An error occurred while saving");
    } finally {
      setIsSavingAffiliation(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Profile Information */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">Profile Information</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                First Name
                <span className="text-red-500 ml-1">*</span>
              </label>
              <Input
                type="text"
                value={profileInfo.firstName}
                onChange={(e) => setProfileInfo({ ...profileInfo, firstName: e.target.value })}
                placeholder="Enter first name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Last Name
                <span className="text-red-500 ml-1">*</span>
              </label>
              <Input
                type="text"
                value={profileInfo.lastName}
                onChange={(e) => setProfileInfo({ ...profileInfo, lastName: e.target.value })}
                placeholder="Enter last name"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Email Address
              <span className="text-red-500 ml-1">*</span>
            </label>
            <Input
              type="email"
              value={profileInfo.email}
              onChange={(e) => setProfileInfo({ ...profileInfo, email: e.target.value })}
              placeholder="Enter email address"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Phone Number
            </label>
            <Input
              type="tel"
              value={profileInfo.phoneNumber}
              onChange={(e) => setProfileInfo({ ...profileInfo, phoneNumber: e.target.value })}
              placeholder="Enter phone number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Country of Residence
            </label>
            <Select
              value={profileInfo.countryOfResidence}
              onChange={(e) => setProfileInfo({ ...profileInfo, countryOfResidence: e.target.value })}
              options={countryList}
            />
          </div>

          <div className="flex justify-end">
            {isManagedNoAccount && onSendInvite ? (
              <Button
                variant="primary"
                onClick={handleSendInvite}
                disabled={isSendingInvite}
                className="flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                {isSendingInvite ? "Sending..." : "Send Invite"}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="flex items-center gap-2"
                data-cy="button-save-account"
              >
                <Save className="h-4 w-4" />
                {isSavingProfile ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Affiliation Information */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">Affiliation Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Agency Name
            </label>
            {isAdmin ? (
              <Autocomplete
                value={affiliationInfo.agencyId?.toString() || ""}
                options={agencyOptions}
                onSelect={(option) => {
                  setAffiliationInfo({
                    ...affiliationInfo,
                    agencyId: option ? Number(option.id) : null,
                  });
                  setSelectedAgencyName(option?.name || "");
                }}
                placeholder="Search agencies..."
                isLoading={isLoadingAgencies}
                onSearch={handleAgencySearch}
              />
            ) : (
              <Input
                type="text"
                value={selectedAgencyName || ""}
                readOnly
                className="bg-zinc-50 dark:bg-zinc-800 cursor-not-allowed"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Sending Church Name
            </label>
            {isAdmin ? (
              <Autocomplete
                value={affiliationInfo.sendingChurchId?.toString() || ""}
                options={sendingChurchOptions}
                onSelect={(option) => {
                  setAffiliationInfo({
                    ...affiliationInfo,
                    sendingChurchId: option ? Number(option.id) : null,
                  });
                  setSelectedSendingChurchName(option?.name || "");
                }}
                placeholder="Search churches..."
                isLoading={isLoadingSendingChurches}
                onSearch={handleSendingChurchSearch}
              />
            ) : (
              <Input
                type="text"
                value={selectedSendingChurchName || ""}
                readOnly
                className="bg-zinc-50 dark:bg-zinc-800 cursor-not-allowed"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Mission Field Church Name 
            </label>
            {isAdmin ? (
              <Autocomplete
                value={affiliationInfo.missionFieldChurchId?.toString() || ""}
                options={missionFieldChurchOptions}
                onSelect={(option) => {
                  setAffiliationInfo({
                    ...affiliationInfo,
                    missionFieldChurchId: option ? Number(option.id) : null,
                  });
                  setSelectedMissionFieldChurchName(option?.name || "");
                }}
                placeholder="Search churches..."
                isLoading={isLoadingMissionFieldChurches}
                onSearch={handleMissionFieldChurchSearch}
              />
            ) : (
              <Input
                type="text"
                value={selectedMissionFieldChurchName || ""}
                readOnly
                className="bg-zinc-50 dark:bg-zinc-800 cursor-not-allowed"
              />
            )}
          </div>

          <div className="border-t border-zinc-200 pt-4">
            <ChurchAffiliationSelector
                missionaryId={missionary.id}
                readOnly={!isAdmin}
                excludeChurchIds={[
                  ...(affiliationInfo.sendingChurchId ? [affiliationInfo.sendingChurchId] : []),
                  ...(affiliationInfo.missionFieldChurchId ? [affiliationInfo.missionFieldChurchId] : []),
                ]}
                onSuccess={onChurchAffiliationChange}
              />
          </div>

          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              If affiliation info is incorrect, please{" "}
              <a
                href="mailto:sbradley@harvest21.com"
                className="text-blue-600 hover:text-blue-800 underline dark:text-blue-400 dark:hover:text-blue-300"
              >
                email
              </a>{" "}
              Harvest 21 admin.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Mission Status
              <span className="text-red-500 ml-1">*</span>
            </label>
            <div className="flex gap-4">
              <Radio
                name="missionStatus"
                value="On-field"
                checked={affiliationInfo.missionStatus === "On-field"}
                onChange={() => setAffiliationInfo({ ...affiliationInfo, missionStatus: "On-field" })}
                label="On-field"
              />
              <Radio
                name="missionStatus"
                value="Furlough"
                checked={affiliationInfo.missionStatus === "Furlough"}
                onChange={() => setAffiliationInfo({ ...affiliationInfo, missionStatus: "Furlough" })}
                label="Furlough"
              />
              <Radio
                name="missionStatus"
                value="Deputation"
                checked={affiliationInfo.missionStatus === "Deputation"}
                onChange={() => setAffiliationInfo({ ...affiliationInfo, missionStatus: "Deputation" })}
                label="Deputation"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Open to Visits
            </label>
            <div className="flex gap-4">
              <Radio
                name="openToVisits"
                value="Yes"
                checked={affiliationInfo.openToVisits === true}
                onChange={() => setAffiliationInfo({ ...affiliationInfo, openToVisits: true })}
                label="Yes"
              />
              <Radio
                name="openToVisits"
                value="No"
                checked={affiliationInfo.openToVisits === false}
                onChange={() => setAffiliationInfo({ ...affiliationInfo, openToVisits: false })}
                label="No"
              />
            </div>
          </div>

          {affiliationInfo.openToVisits && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Visit window start date
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <Input
                  type="date"
                  value={affiliationInfo.visitsStartDate}
                  onChange={(e) => setAffiliationInfo({ ...affiliationInfo, visitsStartDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Visit window end date
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <Input
                  type="date"
                  value={affiliationInfo.visitsEndDate}
                  onChange={(e) => setAffiliationInfo({ ...affiliationInfo, visitsEndDate: e.target.value })}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Destination Country
              <span className="text-red-500 ml-1">*</span>
            </label>
            <Select
              value={affiliationInfo.destinationCountry}
              onChange={(e) => setAffiliationInfo({ ...affiliationInfo, destinationCountry: e.target.value })}
              options={countryList}
              required
            />
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={handleSaveAffiliation}
              disabled={isSavingAffiliation}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSavingAffiliation ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Donation Options</h2>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Choose how supporters can donate to your ministry. Only one option can be active.
        </p>
        <div className="space-y-4">
          <div>
            <div className="flex flex-col gap-3">
              <Radio
                name="donationMode"
                value="harvest21"
                checked={donationMode === "harvest21"}
                onChange={() => setDonationMode("harvest21")}
                label="Harvest 21 donation page (Stripe)"
              />
              <Radio
                name="donationMode"
                value="external"
                checked={donationMode === "external"}
                onChange={() => setDonationMode("external")}
                label="External donation link"
              />
              {donationMode === "external" && (
                <div className="ml-6">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Donation link URL
                  </label>
                  <Input
                    type="url"
                    value={externalDonationUrl}
                    onChange={(e) => setExternalDonationUrl(e.target.value)}
                    placeholder="https://example.com/donate"
                    className="max-w-md"
                  />
                </div>
              )}
              <Radio
                name="donationMode"
                value="off"
                checked={donationMode === "off"}
                onChange={() => setDonationMode("off")}
                label="Donations Off"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={async () => {
                if (!effectivePageId) {
                  toast.error("Page not found. Please complete your page setup first.");
                  return;
                }
                setIsSavingDonationOptions(true);
                try {
                  const result = await updateDonationOptions(
                    effectivePageId,
                    donationMode,
                    donationMode === "external" ? externalDonationUrl.trim() || null : null
                  );
                  if (result.success) {
                    toast.success(result.message ?? "Donation options saved");
                    router.replace("/settings?tab=account", { scroll: false });
                    router.refresh();
                  } else {
                    toast.error(result.message ?? "Failed to save donation options");
                  }
                } catch {
                  toast.error("Failed to save donation options");
                } finally {
                  setIsSavingDonationOptions(false);
                }
              }}
              disabled={isSavingDonationOptions}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSavingDonationOptions ? "Saving..." : "Save Donation Options"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

