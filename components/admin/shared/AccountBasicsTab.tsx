"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Save, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import toast from "react-hot-toast";
import { countryList, getCountryNameFromISO, getISOFromCountryName } from "@/lib/countryHelpers";

type EntityType = "college" | "agency" | "church" | "donor";

type EntityDetailData = {
  id: number;
  name: string;
  contact_user_id: string | null;
  email: string | null;
  phone_number: string | null;
  // Optional because not all entity types (e.g. colleges) currently have this field
  contact_person_phone_number?: string | null;
  address: string | null;
  city: string | null;
  state?: string | null;
  country: string | null;
  website: string | null;
  created_at: string;
  contactUser: {
    user_id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    status: string;
  } | null;
};

type AccountBasicsTabProps = {
  entity: EntityDetailData;
  type: EntityType;
  onUpdateEntity: (id: number, data: {
    name: string;
    website?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    phoneNumber?: string;
  }) => Promise<{ success: boolean; message?: string; data?: { name: string; website?: string | null; address?: string | null; city?: string | null; state?: string | null; country?: string | null; phone_number?: string | null } }>;
  onUpdateContact: (userId: string, data: {
    firstName: string;
    lastName: string;
    email: string;
    contactPersonPhoneNumber?: string;
  }) => Promise<{ success: boolean; message?: string; data?: { first_name: string; last_name: string; email: string }; contactPersonPhoneNumber?: string | null }>;
  onSendInvite?: (data: { email: string; firstName: string; lastName: string; contactPersonPhoneNumber?: string }) => Promise<{ success: boolean; message?: string }>;
};

const getEntityLabel = (type: EntityType): { info: string; name: string } => {
  switch (type) {
    case "college":
      return { info: "College Information", name: "College Name" };
    case "agency":
      return { info: "Agency Information", name: "Agency Name" };
    case "church":
      return { info: "Church Information", name: "Church Name" };
    default:
      return { info: "Information", name: "Name" };
  }
};

export function AccountBasicsTab({ 
  entity, 
  type, 
  onUpdateEntity, 
  onUpdateContact,
  onSendInvite,
}: AccountBasicsTabProps) {
  const router = useRouter();
  const labels = getEntityLabel(type);
  
  const initialEntityInfo = useMemo(() => {
    const info = {
      name: entity.name || "",
      website: entity.website ?? "",
      address: entity.address ?? "",
      city: entity.city ?? "",
      state: entity.state ?? "",
      country: getCountryNameFromISO(entity.country) || entity.country || "",
      phoneNumber: entity.phone_number || "",
    };
    return info;
  }, [entity.name, entity.website, entity.address, entity.city, entity.state, entity.country, entity.phone_number]);

  const initialContactInfo = useMemo(() => {
    return {
      firstName: entity.contactUser?.first_name || "",
      lastName: entity.contactUser?.last_name || "",
      email: entity.contactUser?.email || entity.email || "",
      // Convert null to empty string for display
      contactPersonPhoneNumber: entity.contact_person_phone_number ?? "",
    };
  }, [entity.contactUser?.first_name, entity.contactUser?.last_name, entity.contactUser?.email, entity.email, entity.contact_person_phone_number]);

  const [entityInfo, setEntityInfo] = useState(initialEntityInfo);
  const [contactInfo, setContactInfo] = useState(initialContactInfo);
  
  // Track the last saved phone numbers and timestamps to prevent useEffect from overriding our immediate state updates
  const lastSavedEntityPhoneNumberRef = useRef<{ value: string; timestamp: number } | null>(null);
  const lastSavedContactPhoneNumberRef = useRef<{ value: string; timestamp: number } | null>(null);
  
  // Track current state values in refs to access them in useEffect without causing dependency issues
  const entityInfoRef = useRef(entityInfo);
  const contactInfoRef = useRef(contactInfo);
  
  // Update refs when state changes
  useEffect(() => {
    entityInfoRef.current = entityInfo;
  }, [entityInfo]);
  
  useEffect(() => {
    contactInfoRef.current = contactInfo;
  }, [contactInfo]);

  // Sync state when entity prop changes
  useEffect(() => {
    const entityPhoneNumber = entity.phone_number ?? "";
    const contactPersonPhoneNumber = entity.contact_person_phone_number ?? "";
    
    // Check if we should skip syncing entity phone number
    if (lastSavedEntityPhoneNumberRef.current !== null) {
      const saved = lastSavedEntityPhoneNumberRef.current;
      const timeSinceSave = Date.now() - saved.timestamp;
      const entityValue = entityPhoneNumber;
      
      // If less than 2 seconds have passed since save, and entity prop doesn't match what we saved,
      // it means the entity prop hasn't updated yet - skip syncing to preserve our immediate state update
      if (timeSinceSave < 2000 && entityValue !== saved.value) {
        // Don't return here, just skip updating phoneNumber in newEntityInfo
      } else if (entityValue === saved.value || timeSinceSave >= 2000) {
        // Entity prop matches what we saved, or enough time has passed - clear the ref
        lastSavedEntityPhoneNumberRef.current = null;
      }
    }
    
    // Check if we should skip syncing contact person phone number
    if (lastSavedContactPhoneNumberRef.current !== null) {
      const saved = lastSavedContactPhoneNumberRef.current;
      const timeSinceSave = Date.now() - saved.timestamp;
      const entityValue = contactPersonPhoneNumber;
      
      // If less than 2 seconds have passed since save, and entity prop doesn't match what we saved,
      // it means the entity prop hasn't updated yet - skip syncing to preserve our immediate state update
      if (timeSinceSave < 2000 && entityValue !== saved.value) {
        // Don't return here, just skip updating contactPersonPhoneNumber in newContactInfo
      } else if (entityValue === saved.value || timeSinceSave >= 2000) {
        // Entity prop matches what we saved, or enough time has passed - clear the ref
        lastSavedContactPhoneNumberRef.current = null;
      }
    }
    
    // Check if we should use saved phone number values (within 2 seconds of save)
    const shouldUseSavedEntityPhone = lastSavedEntityPhoneNumberRef.current !== null && 
                                      Date.now() - lastSavedEntityPhoneNumberRef.current.timestamp < 2000;
    
    const shouldUseSavedContactPhone = lastSavedContactPhoneNumberRef.current !== null && 
                                       Date.now() - lastSavedContactPhoneNumberRef.current.timestamp < 2000;
    
    // Clear refs if enough time has passed or entity prop matches saved value
    if (lastSavedEntityPhoneNumberRef.current !== null) {
      const saved = lastSavedEntityPhoneNumberRef.current;
      const timeSinceSave = Date.now() - saved.timestamp;
      if (timeSinceSave >= 2000 || entityPhoneNumber === saved.value) {
        lastSavedEntityPhoneNumberRef.current = null;
      }
    }
    
    if (lastSavedContactPhoneNumberRef.current !== null) {
      const saved = lastSavedContactPhoneNumberRef.current;
      const timeSinceSave = Date.now() - saved.timestamp;
      if (timeSinceSave >= 2000 || contactPersonPhoneNumber === saved.value) {
        lastSavedContactPhoneNumberRef.current = null;
      }
    }
    
    const newEntityInfo = {
      name: entity.name || "",
      website: entity.website ?? "",
      address: entity.address ?? "",
      city: entity.city ?? "",
      state: entity.state ?? "",
      country: getCountryNameFromISO(entity.country) || entity.country || "",
      // Always use saved value if available (never return old value), otherwise use entity prop value
      phoneNumber: shouldUseSavedEntityPhone && lastSavedEntityPhoneNumberRef.current
        ? lastSavedEntityPhoneNumberRef.current.value // Use the saved value, never old value
        : entityPhoneNumber, // Use entity prop value
    };
    const newContactInfo = {
      firstName: entity.contactUser?.first_name || "",
      lastName: entity.contactUser?.last_name || "",
      email: entity.contactUser?.email || entity.email || "",
      // Always use saved value if available (never return old value), otherwise use entity prop value
      contactPersonPhoneNumber: shouldUseSavedContactPhone && lastSavedContactPhoneNumberRef.current
        ? lastSavedContactPhoneNumberRef.current.value // Use the saved value, never old value
        : contactPersonPhoneNumber, // Use entity prop value
    };
    
    setEntityInfo(newEntityInfo);
    setContactInfo(newContactInfo);
  }, [
    entity.name,
    entity.website,
    entity.address,
    entity.city,
    entity.state,
    entity.country,
    entity.phone_number,
    entity.contact_person_phone_number,
    entity.contactUser?.first_name,
    entity.contactUser?.last_name,
    entity.contactUser?.email,
    entity.email,
  ]);

  const [isSavingEntity, setIsSavingEntity] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const isManagedNoContact = entity.contact_user_id == null;

  const handleSaveEntityInfo = async () => {
    // Validate required fields
    if (!entityInfo.name || entityInfo.name.trim() === "") {
      toast.error(`${labels.name} is required`);
      return;
    }

    setIsSavingEntity(true);
    try {
      const updateData: {
        name: string;
        website?: string;
        address?: string;
        city?: string;
        state?: string;
        country?: string;
        phoneNumber?: string;
      } = {
        name: entityInfo.name,
        website: entityInfo.website,
        address: entityInfo.address,
        city: entityInfo.city,
        country: getISOFromCountryName(entityInfo.country) || entityInfo.country,
      };

      // Include state for churches and agencies (optional field)
      if (type === "church" || type === "agency") {
        updateData.state = entityInfo.state || undefined;
        updateData.phoneNumber = entityInfo.phoneNumber || undefined;
      }

      const result = await onUpdateEntity(entity.id, updateData);

      if (result.success) {
        toast.success(`${labels.info} saved successfully!`);
        
        // Always use the saved phone number value from the server response (convert null to empty string for display)
        const savedPhoneNumber = result.data?.phone_number ?? "";
        
        // Track the saved phone number and timestamp to prevent useEffect from overriding it
        lastSavedEntityPhoneNumberRef.current = {
          value: savedPhoneNumber,
          timestamp: Date.now()
        };
        
        // Update local state immediately with ONLY the saved values from database
        // Never use old values - always replace with the new saved value
        if (result.data) {
          setEntityInfo({
            name: result.data.name || "",
            website: result.data.website ?? "",
            address: result.data.address ?? "",
            city: result.data.city ?? "",
            state: result.data.state ?? "",
            country: getCountryNameFromISO(result.data.country) || result.data.country || "",
            phoneNumber: savedPhoneNumber, // Always use the saved value, never the old value
          });
        }
        
        // Refresh the page to fetch and display the latest data from database
        // This ensures the entity prop is updated with fresh data from the server
        router.refresh();
      } else {
        toast.error(result.message || `Failed to save ${labels.info.toLowerCase()}`);
      }
    } catch (error) {
      console.error("Error saving entity info:", error);
      toast.error("An error occurred while saving");
    } finally {
      setIsSavingEntity(false);
    }
  };

  const handleSendInvite = async () => {
    if (!onSendInvite || !isManagedNoContact) return;
    if (!contactInfo.firstName?.trim() || !contactInfo.lastName?.trim()) {
      toast.error("First name and last name are required");
      return;
    }
    if (!contactInfo.email?.trim()) {
      toast.error("Email is required to send invite");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactInfo.email)) {
      toast.error("Invalid email format");
      return;
    }
    setIsSendingInvite(true);
    try {
      const result = await onSendInvite({
        email: contactInfo.email.trim(),
        firstName: contactInfo.firstName.trim(),
        lastName: contactInfo.lastName.trim(),
        contactPersonPhoneNumber: contactInfo.contactPersonPhoneNumber?.trim() || undefined,
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

  const handleSaveContactInfo = async () => {
    if (!entity.contact_user_id) {
      toast.error("Contact user not found");
      return;
    }
    if (isManagedNoContact) return;

    // Validate required fields
    if (!contactInfo.firstName || contactInfo.firstName.trim() === "") {
      toast.error("First name is required");
      return;
    }
    if (!contactInfo.lastName || contactInfo.lastName.trim() === "") {
      toast.error("Last name is required");
      return;
    }
    if (!contactInfo.email || contactInfo.email.trim() === "") {
      toast.error("Email is required");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactInfo.email)) {
      toast.error("Invalid email format");
      return;
    }

    setIsSavingContact(true);
    try {
      const result = await onUpdateContact(entity.contact_user_id, {
        firstName: contactInfo.firstName,
        lastName: contactInfo.lastName,
        email: contactInfo.email,
        contactPersonPhoneNumber: contactInfo.contactPersonPhoneNumber,
      });

      if (result.success) {
        toast.success("Contact person information saved successfully!");
        
        // Get the saved phone number value (convert null to empty string for display)
        const savedPhoneNumber = result.contactPersonPhoneNumber !== undefined 
          ? (result.contactPersonPhoneNumber ?? "") 
          : contactInfo.contactPersonPhoneNumber;
        
        // Track the saved phone number and timestamp to prevent useEffect from overriding it
        lastSavedContactPhoneNumberRef.current = {
          value: savedPhoneNumber,
          timestamp: Date.now()
        };
        
        // Update local state immediately with the saved values from database
        // This ensures the UI reflects the saved data right away, even before router.refresh()
        const updatedContactInfo = {
          firstName: result.data?.first_name || contactInfo.firstName,
          lastName: result.data?.last_name || contactInfo.lastName,
          email: result.data?.email || contactInfo.email,
          contactPersonPhoneNumber: savedPhoneNumber,
        };
        
        // Update state immediately to reflect the saved value
        setContactInfo(updatedContactInfo);
        
        // Refresh the page to fetch and display the latest data from database
        // This ensures the entity prop is updated with fresh data from the server
        router.refresh();
      } else {
        toast.error(result.message || "Failed to save contact person information");
      }
    } catch (error) {
      console.error("Error saving contact info:", error);
      toast.error("An error occurred while saving");
    } finally {
      setIsSavingContact(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Entity Information */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">{labels.info}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              {labels.name}
            </label>
            <Input
              type="text"
              value={entityInfo.name}
              onChange={(e) => setEntityInfo({ ...entityInfo, name: e.target.value })}
              placeholder={`Enter ${type} name`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Website
            </label>
            <Input
              type="url"
              value={entityInfo.website}
              onChange={(e) => setEntityInfo({ ...entityInfo, website: e.target.value })}
              placeholder="https://example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Address
            </label>
            <Input
              type="text"
              value={entityInfo.address}
              onChange={(e) => setEntityInfo({ ...entityInfo, address: e.target.value })}
              placeholder="Enter address"
            />
          </div>

          {(type === "church" || type === "agency") && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Phone Number
              </label>
              <Input
                type="tel"
                value={entityInfo.phoneNumber}
                onChange={(e) => setEntityInfo({ ...entityInfo, phoneNumber: e.target.value })}
                placeholder="Enter phone number"
              />
            </div>
          )}

          <div className={(type === "church" || type === "agency") ? "grid grid-cols-1 md:grid-cols-3 gap-4" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                City
              </label>
              <Input
                type="text"
                value={entityInfo.city}
                onChange={(e) => setEntityInfo({ ...entityInfo, city: e.target.value })}
                placeholder="Enter city"
              />
            </div>

            {(type === "church" || type === "agency") && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  State
                </label>
                <Input
                  type="text"
                  value={entityInfo.state}
                  onChange={(e) => setEntityInfo({ ...entityInfo, state: e.target.value })}
                  placeholder="Enter state"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Country
              </label>
              <Select
                value={entityInfo.country}
                onChange={(e) => setEntityInfo({ ...entityInfo, country: e.target.value })}
                options={countryList}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={handleSaveEntityInfo}
              disabled={isSavingEntity}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSavingEntity ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>

      {/* Contact Person Information */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">Contact Person Information</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                First Name
                <span className="text-red-500 ml-1">*</span>
              </label>
              <Input
                type="text"
                value={contactInfo.firstName}
                onChange={(e) => setContactInfo({ ...contactInfo, firstName: e.target.value })}
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
                value={contactInfo.lastName}
                onChange={(e) => setContactInfo({ ...contactInfo, lastName: e.target.value })}
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
              value={contactInfo.email}
              onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
              placeholder="Enter email address"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Contact Person Phone Number
            </label>
            <Input
              type="tel"
              value={contactInfo.contactPersonPhoneNumber}
              onChange={(e) => setContactInfo({ ...contactInfo, contactPersonPhoneNumber: e.target.value })}
              placeholder="Enter contact person phone number"
            />
          </div>

          <div className="flex justify-end">
            {isManagedNoContact && onSendInvite ? (
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
                onClick={handleSaveContactInfo}
                disabled={isSavingContact}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {isSavingContact ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

