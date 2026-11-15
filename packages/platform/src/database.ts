
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "appointment_series": {
                  Row: {
                    "business_id": string,"created_at": string,"created_by": string | null,"id": string,"interval_weeks": number,"occurrences": number
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"interval_weeks": number,"occurrences": number
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"interval_weeks"?: number,"occurrences"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointment_series_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"appointment_services": {
                  Row: {
                    "appointment_id": string,"business_id": string,"duration_minutes": number,"id": string,"name": string,"position": number,"price_cents": number,"service_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id": string,"business_id": string,"duration_minutes": number,"id"?: string,"name": string,"position"?: number,"price_cents": number,"service_id"?: string | null
                  }
                  Update: {
                    "appointment_id"?: string,"business_id"?: string,"duration_minutes"?: number,"id"?: string,"name"?: string,"position"?: number,"price_cents"?: number,"service_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointment_services_appointment_id_business_id_fkey"
      columns: ["appointment_id","business_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "appointment_services_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointment_services_service_id_business_id_fkey"
      columns: ["service_id","business_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"appointments": {
                  Row: {
                    "business_id": string,"cancellation_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"created_by": string | null,"customer_id": string,"customer_notes": string | null,"ends_at": string,"groomer_id": string,"grooming_record_id": string | null,"id": string,"location_id": string,"manage_token_hash": string | null,"notes": string | null,"pet_id": string,"price_estimate_cents": number | null,"price_from": boolean,"series_id": string | null,"service_ends_at": string,"source": string,"starts_at": string,"status": Database["public"]['Enums']["appointment_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"cancellation_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id": string,"customer_notes"?: string | null,"ends_at": string,"groomer_id": string,"grooming_record_id"?: string | null,"id"?: string,"location_id": string,"manage_token_hash"?: string | null,"notes"?: string | null,"pet_id": string,"price_estimate_cents"?: number | null,"price_from"?: boolean,"series_id"?: string | null,"service_ends_at": string,"source"?: string,"starts_at": string,"status"?: Database["public"]['Enums']["appointment_status"],"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"cancellation_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string,"customer_notes"?: string | null,"ends_at"?: string,"groomer_id"?: string,"grooming_record_id"?: string | null,"id"?: string,"location_id"?: string,"manage_token_hash"?: string | null,"notes"?: string | null,"pet_id"?: string,"price_estimate_cents"?: number | null,"price_from"?: boolean,"series_id"?: string | null,"service_ends_at"?: string,"source"?: string,"starts_at"?: string,"status"?: Database["public"]['Enums']["appointment_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointments_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_customer_id_business_id_fkey"
      columns: ["customer_id","business_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "appointments_groomer_id_business_id_fkey"
      columns: ["groomer_id","business_id"]
isOneToOne: false
      referencedRelation: "business_members"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "appointments_grooming_record_id_business_id_fkey"
      columns: ["grooming_record_id","business_id"]
isOneToOne: false
      referencedRelation: "grooming_records"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "appointments_location_id_business_id_fkey"
      columns: ["location_id","business_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "appointments_pet_id_business_id_fkey"
      columns: ["pet_id","business_id"]
isOneToOne: false
      referencedRelation: "pets"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "appointments_pet_id_customer_id_fkey"
      columns: ["pet_id","customer_id"]
isOneToOne: false
      referencedRelation: "pets"
      referencedColumns: ["id","customer_id"]
    },{
      foreignKeyName: "appointments_series_id_business_id_fkey"
      columns: ["series_id","business_id"]
isOneToOne: false
      referencedRelation: "appointment_series"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"business_id": string | null,"created_at": string,"entity": string | null,"entity_id": string | null,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"business_id"?: string | null,"created_at"?: string,"entity"?: string | null,"entity_id"?: string | null,"id"?: never
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"business_id"?: string | null,"created_at"?: string,"entity"?: string | null,"entity_id"?: string | null,"id"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_attempts": {
                  Row: {
                    "business_id": string,"client_hash": string | null,"created_at": string,"email_hash": string,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"client_hash"?: string | null,"created_at"?: string,"email_hash": string,"id"?: never
                  }
                  Update: {
                    "business_id"?: string,"client_hash"?: string | null,"created_at"?: string,"email_hash"?: string,"id"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_attempts_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_policies": {
                  Row: {
                    "business_id": string,"cancellation_hours": number,"max_days_ahead": number,"min_notice_minutes": number,"online_enabled": boolean,"policy_text": string | null,"slot_step_minutes": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"cancellation_hours"?: number,"max_days_ahead"?: number,"min_notice_minutes"?: number,"online_enabled"?: boolean,"policy_text"?: string | null,"slot_step_minutes"?: number,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"cancellation_hours"?: number,"max_days_ahead"?: number,"min_notice_minutes"?: number,"online_enabled"?: boolean,"policy_text"?: string | null,"slot_step_minutes"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_policies_business_id_fkey"
      columns: ["business_id"]
isOneToOne: true
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"business_closures": {
                  Row: {
                    "business_id": string,"created_at": string,"ends_on": string,"id": string,"location_id": string | null,"reason": string | null,"starts_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"ends_on": string,"id"?: string,"location_id"?: string | null,"reason"?: string | null,"starts_on": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"ends_on"?: string,"id"?: string,"location_id"?: string | null,"reason"?: string | null,"starts_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_closures_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "business_closures_location_id_business_id_fkey"
      columns: ["location_id","business_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"business_members": {
                  Row: {
                    "business_id": string,"created_at": string,"display_name": string | null,"id": string,"role": Database["public"]['Enums']["business_role"],"status": Database["public"]['Enums']["member_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"display_name"?: string | null,"id"?: string,"role": Database["public"]['Enums']["business_role"],"status"?: Database["public"]['Enums']["member_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"display_name"?: string | null,"id"?: string,"role"?: Database["public"]['Enums']["business_role"],"status"?: Database["public"]['Enums']["member_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_members_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"businesses": {
                  Row: {
                    "abn": string | null,"country_code": string,"created_at": string,"created_by": string | null,"currency": string,"email": string | null,"gst_registered": boolean,"id": string,"name": string,"phone": string | null,"plan": Database["public"]['Enums']["plan_tier"],"product": string,"slug": string,"status": Database["public"]['Enums']["business_status"],"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "abn"?: string | null,"country_code"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"email"?: string | null,"gst_registered"?: boolean,"id"?: string,"name": string,"phone"?: string | null,"plan"?: Database["public"]['Enums']["plan_tier"],"product"?: string,"slug": string,"status"?: Database["public"]['Enums']["business_status"],"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "abn"?: string | null,"country_code"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"email"?: string | null,"gst_registered"?: boolean,"id"?: string,"name"?: string,"phone"?: string | null,"plan"?: Database["public"]['Enums']["plan_tier"],"product"?: string,"slug"?: string,"status"?: Database["public"]['Enums']["business_status"],"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"customer_contacts": {
                  Row: {
                    "address_line": string | null,"business_id": string,"customer_id": string,"email": string | null,"mobile": string | null,"postcode": string | null,"state": string | null,"suburb": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address_line"?: string | null,"business_id": string,"customer_id": string,"email"?: string | null,"mobile"?: string | null,"postcode"?: string | null,"state"?: string | null,"suburb"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address_line"?: string | null,"business_id"?: string,"customer_id"?: string,"email"?: string | null,"mobile"?: string | null,"postcode"?: string | null,"state"?: string | null,"suburb"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "customer_contacts_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "customer_contacts_customer_id_business_id_fkey"
      columns: ["customer_id","business_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"customers": {
                  Row: {
                    "archived_at": string | null,"business_id": string,"created_at": string,"created_by": string | null,"first_name": string,"id": string,"is_vip": boolean,"last_name": string | null,"marketing_consent": boolean,"marketing_consent_at": string | null,"notes": string | null,"photo_path": string | null,"preferred_contact": Database["public"]['Enums']["contact_method"],"preferred_groomer_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"business_id": string,"created_at"?: string,"created_by"?: string | null,"first_name": string,"id"?: string,"is_vip"?: boolean,"last_name"?: string | null,"marketing_consent"?: boolean,"marketing_consent_at"?: string | null,"notes"?: string | null,"photo_path"?: string | null,"preferred_contact"?: Database["public"]['Enums']["contact_method"],"preferred_groomer_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"first_name"?: string,"id"?: string,"is_vip"?: boolean,"last_name"?: string | null,"marketing_consent"?: boolean,"marketing_consent_at"?: string | null,"notes"?: string | null,"photo_path"?: string | null,"preferred_contact"?: Database["public"]['Enums']["contact_method"],"preferred_groomer_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "customers_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "customers_preferred_groomer_id_business_id_fkey"
      columns: ["preferred_groomer_id","business_id"]
isOneToOne: false
      referencedRelation: "business_members"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"dashboard_layouts": {
                  Row: {
                    "business_id": string,"layout": NonNullable<Json>,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"layout"?: NonNullable<Json>,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "business_id"?: string,"layout"?: NonNullable<Json>,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dashboard_layouts_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"grooming_photos": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"kind": Database["public"]['Enums']["photo_kind"],"record_id": string,"storage_path": string,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["photo_kind"],"record_id": string,"storage_path": string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["photo_kind"],"record_id"?: string,"storage_path"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "grooming_photos_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "grooming_photos_record_id_business_id_fkey"
      columns: ["record_id","business_id"]
isOneToOne: false
      referencedRelation: "grooming_records"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"grooming_records": {
                  Row: {
                    "business_id": string,"created_at": string,"created_by": string | null,"customer_feedback": string | null,"customer_instructions": string | null,"duration_minutes": number | null,"groomed_on": string,"groomer_id": string | null,"haircut": string | null,"id": string,"observations": string | null,"pet_id": string,"service_ids": (string)[],"services_summary": string | null,"shampoo": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"created_by"?: string | null,"customer_feedback"?: string | null,"customer_instructions"?: string | null,"duration_minutes"?: number | null,"groomed_on": string,"groomer_id"?: string | null,"haircut"?: string | null,"id"?: string,"observations"?: string | null,"pet_id": string,"service_ids"?: (string)[],"services_summary"?: string | null,"shampoo"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"created_by"?: string | null,"customer_feedback"?: string | null,"customer_instructions"?: string | null,"duration_minutes"?: number | null,"groomed_on"?: string,"groomer_id"?: string | null,"haircut"?: string | null,"id"?: string,"observations"?: string | null,"pet_id"?: string,"service_ids"?: (string)[],"services_summary"?: string | null,"shampoo"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "grooming_records_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "grooming_records_groomer_id_business_id_fkey"
      columns: ["groomer_id","business_id"]
isOneToOne: false
      referencedRelation: "business_members"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "grooming_records_pet_id_business_id_fkey"
      columns: ["pet_id","business_id"]
isOneToOne: false
      referencedRelation: "pets"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"location_hours": {
                  Row: {
                    "business_id": string,"closes": string,"id": string,"location_id": string,"opens": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"closes": string,"id"?: string,"location_id": string,"opens": string,"weekday": number
                  }
                  Update: {
                    "business_id"?: string,"closes"?: string,"id"?: string,"location_id"?: string,"opens"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "location_hours_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "location_hours_location_id_business_id_fkey"
      columns: ["location_id","business_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"locations": {
                  Row: {
                    "address_line": string | null,"archived_at": string | null,"business_id": string,"created_at": string,"id": string,"is_mobile": boolean,"name": string,"phone": string | null,"postcode": string | null,"state": string | null,"suburb": string | null,"timezone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address_line"?: string | null,"archived_at"?: string | null,"business_id": string,"created_at"?: string,"id"?: string,"is_mobile"?: boolean,"name": string,"phone"?: string | null,"postcode"?: string | null,"state"?: string | null,"suburb"?: string | null,"timezone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address_line"?: string | null,"archived_at"?: string | null,"business_id"?: string,"created_at"?: string,"id"?: string,"is_mobile"?: boolean,"name"?: string,"phone"?: string | null,"postcode"?: string | null,"state"?: string | null,"suburb"?: string | null,"timezone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "locations_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"pets": {
                  Row: {
                    "allergies": string | null,"archived_at": string | null,"behaviour": string | null,"breed": string | null,"business_id": string,"coat_colour": string | null,"coat_length": string | null,"coat_type": string | null,"created_at": string,"customer_id": string,"date_of_birth": string | null,"desexed": boolean | null,"ear_cleaning": string | null,"emergency_contact": string | null,"estimated_age_years": number | null,"finishing_products": string | null,"groom_interval_weeks": number | null,"grooming_style": string | null,"handling_precautions": string | null,"handling_preferences": string | null,"id": string,"medical_notes": string | null,"microchip": string | null,"nail_preferences": string | null,"name": string,"noise_sensitivity": string | null,"photo_path": string | null,"preferred_cut": string | null,"sensitivities": string | null,"sex": Database["public"]['Enums']["pet_sex"],"shampoo": string | null,"size": Database["public"]['Enums']["pet_size"] | null,"skin_coat_concerns": string | null,"species": Database["public"]['Enums']["pet_species"],"updated_at": string,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "allergies"?: string | null,"archived_at"?: string | null,"behaviour"?: string | null,"breed"?: string | null,"business_id": string,"coat_colour"?: string | null,"coat_length"?: string | null,"coat_type"?: string | null,"created_at"?: string,"customer_id": string,"date_of_birth"?: string | null,"desexed"?: boolean | null,"ear_cleaning"?: string | null,"emergency_contact"?: string | null,"estimated_age_years"?: number | null,"finishing_products"?: string | null,"groom_interval_weeks"?: number | null,"grooming_style"?: string | null,"handling_precautions"?: string | null,"handling_preferences"?: string | null,"id"?: string,"medical_notes"?: string | null,"microchip"?: string | null,"nail_preferences"?: string | null,"name": string,"noise_sensitivity"?: string | null,"photo_path"?: string | null,"preferred_cut"?: string | null,"sensitivities"?: string | null,"sex"?: Database["public"]['Enums']["pet_sex"],"shampoo"?: string | null,"size"?: Database["public"]['Enums']["pet_size"] | null,"skin_coat_concerns"?: string | null,"species"?: Database["public"]['Enums']["pet_species"],"updated_at"?: string,"weight_kg"?: number | null
                  }
                  Update: {
                    "allergies"?: string | null,"archived_at"?: string | null,"behaviour"?: string | null,"breed"?: string | null,"business_id"?: string,"coat_colour"?: string | null,"coat_length"?: string | null,"coat_type"?: string | null,"created_at"?: string,"customer_id"?: string,"date_of_birth"?: string | null,"desexed"?: boolean | null,"ear_cleaning"?: string | null,"emergency_contact"?: string | null,"estimated_age_years"?: number | null,"finishing_products"?: string | null,"groom_interval_weeks"?: number | null,"grooming_style"?: string | null,"handling_precautions"?: string | null,"handling_preferences"?: string | null,"id"?: string,"medical_notes"?: string | null,"microchip"?: string | null,"nail_preferences"?: string | null,"name"?: string,"noise_sensitivity"?: string | null,"photo_path"?: string | null,"preferred_cut"?: string | null,"sensitivities"?: string | null,"sex"?: Database["public"]['Enums']["pet_sex"],"shampoo"?: string | null,"size"?: Database["public"]['Enums']["pet_size"] | null,"skin_coat_concerns"?: string | null,"species"?: Database["public"]['Enums']["pet_species"],"updated_at"?: string,"weight_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "pets_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pets_customer_id_business_id_fkey"
      columns: ["customer_id","business_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string | null,"id": string,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name"?: string | null,"id": string,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string | null,"id"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"service_price_rules": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"kind": Database["public"]['Enums']["price_rule_kind"],"match_value": string,"price_cents": number,"service_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["price_rule_kind"],"match_value": string,"price_cents": number,"service_id": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["price_rule_kind"],"match_value"?: string,"price_cents"?: number,"service_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_price_rules_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_price_rules_service_id_business_id_fkey"
      columns: ["service_id","business_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"services": {
                  Row: {
                    "active": boolean,"base_price_cents": number,"bookable_online": boolean,"buffer_minutes": number,"business_id": string,"category": string | null,"created_at": string,"description": string | null,"duration_minutes": number,"id": string,"name": string,"position": number,"price_from": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"base_price_cents": number,"bookable_online"?: boolean,"buffer_minutes"?: number,"business_id": string,"category"?: string | null,"created_at"?: string,"description"?: string | null,"duration_minutes": number,"id"?: string,"name": string,"position"?: number,"price_from"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"base_price_cents"?: number,"bookable_online"?: boolean,"buffer_minutes"?: number,"business_id"?: string,"category"?: string | null,"created_at"?: string,"description"?: string | null,"duration_minutes"?: number,"id"?: string,"name"?: string,"position"?: number,"price_from"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "services_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_hours": {
                  Row: {
                    "business_id": string,"ends": string,"id": string,"location_id": string,"member_id": string,"starts": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"ends": string,"id"?: string,"location_id": string,"member_id": string,"starts": string,"weekday": number
                  }
                  Update: {
                    "business_id"?: string,"ends"?: string,"id"?: string,"location_id"?: string,"member_id"?: string,"starts"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_hours_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_hours_location_id_business_id_fkey"
      columns: ["location_id","business_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "staff_hours_member_id_business_id_fkey"
      columns: ["member_id","business_id"]
isOneToOne: false
      referencedRelation: "business_members"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"staff_time_off": {
                  Row: {
                    "business_id": string,"created_at": string,"ends_at": string,"id": string,"member_id": string,"reason": string | null,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"ends_at": string,"id"?: string,"member_id": string,"reason"?: string | null,"starts_at": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"ends_at"?: string,"id"?: string,"member_id"?: string,"reason"?: string | null,"starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_time_off_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_time_off_member_id_business_id_fkey"
      columns: ["member_id","business_id"]
isOneToOne: false
      referencedRelation: "business_members"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"waitlist_entries": {
                  Row: {
                    "business_id": string,"created_at": string,"created_by": string | null,"customer_id": string,"earliest_on": string,"id": string,"latest_on": string,"location_id": string | null,"notes": string | null,"pet_id": string,"preferred_groomer_id": string | null,"service_ids": (string)[],"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"created_by"?: string | null,"customer_id": string,"earliest_on": string,"id"?: string,"latest_on": string,"location_id"?: string | null,"notes"?: string | null,"pet_id": string,"preferred_groomer_id"?: string | null,"service_ids"?: (string)[],"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string,"earliest_on"?: string,"id"?: string,"latest_on"?: string,"location_id"?: string | null,"notes"?: string | null,"pet_id"?: string,"preferred_groomer_id"?: string | null,"service_ids"?: (string)[],"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "waitlist_entries_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "waitlist_entries_customer_id_business_id_fkey"
      columns: ["customer_id","business_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "waitlist_entries_location_id_business_id_fkey"
      columns: ["location_id","business_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "waitlist_entries_pet_id_customer_id_fkey"
      columns: ["pet_id","customer_id"]
isOneToOne: false
      referencedRelation: "pets"
      referencedColumns: ["id","customer_id"]
    },{
      foreignKeyName: "waitlist_entries_preferred_groomer_id_business_id_fkey"
      columns: ["preferred_groomer_id","business_id"]
isOneToOne: false
      referencedRelation: "business_members"
      referencedColumns: ["id","business_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "booking_context":
{ Args: { "p_from": string,"p_slug": string,"p_to": string }; Returns: Json
                           },
"business_slug_available":
{ Args: { "p_slug": string }; Returns: boolean
                           },
"cancel_booking_by_token":
{ Args: { "p_token": string }; Returns: undefined
                           },
"create_business":
{ Args: { "p_location_name"?: string,"p_name": string,"p_slug": string,"p_timezone": string }; Returns: string
                           },
"create_online_booking":
{ Args: { "p_client_hash"?: string,"p_customer": Json,"p_groomer": string,"p_location": string,"p_notes"?: string,"p_pet": Json,"p_service_ids": (string)[],"p_slug": string,"p_starts_at": string }; Returns: Json
                           },
"customer_directory":
{ Args: { "p_business": string,"p_query"?: string }; Returns: {
              "created_at": string,"first_name": string,"groom_count": number,"id": string,"is_vip": boolean,"last_groomed_on": string,"last_name": string,"next_due_on": string,"pet_names": (string)[]
            }[]
                           },
"get_booking_by_token":
{ Args: { "p_token": string }; Returns: Json
                           },
"has_business_role":
{ Args: { "p_business": string,"p_roles": (Database["public"]['Enums']["business_role"])[] }; Returns: boolean
                           },
"is_business_member":
{ Args: { "p_business": string }; Returns: boolean
                           },
"media_business":
{ Args: { "p_name": string }; Returns: string
                           },
"pick_groomer":
{ Args: { "p_business": string,"p_ends": string,"p_exclude"?: string,"p_groomer": string,"p_location": string,"p_starts": string }; Returns: string
                           },
"reschedule_booking_by_token":
{ Args: { "p_groomer"?: string,"p_starts_at": string,"p_token": string }; Returns: Json
                           },
"service_price_for":
{ Args: { "p_breed": string,"p_service": string,"p_size": string }; Returns: number
                           },
"set_appointment_status":
{ Args: { "p_id": string,"p_reason"?: string,"p_status": Database["public"]['Enums']["appointment_status"] }; Returns: undefined
                           },
"slot_fits_hours":
{ Args: { "p_ends": string,"p_groomer": string,"p_location": string,"p_starts": string }; Returns: boolean
                           }
          }
          Enums: {
            "appointment_status": "booked"|"confirmed"|"checked_in"|"in_progress"|"completed"|"cancelled"|"no_show","business_role": "owner"|"manager"|"receptionist"|"groomer","business_status": "active"|"suspended"|"closed","contact_method": "email"|"sms"|"phone","member_status": "active"|"invited"|"suspended","pet_sex": "male"|"female"|"unknown","pet_size": "toy"|"small"|"medium"|"large"|"giant","pet_species": "dog"|"cat"|"other","photo_kind": "before"|"after","plan_tier": "starter"|"growth"|"pro","price_rule_kind": "size"|"breed"|"coat_condition"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "appointment_status": ["booked", "confirmed", "checked_in", "in_progress", "completed", "cancelled", "no_show"],"business_role": ["owner", "manager", "receptionist", "groomer"],"business_status": ["active", "suspended", "closed"],"contact_method": ["email", "sms", "phone"],"member_status": ["active", "invited", "suspended"],"pet_sex": ["male", "female", "unknown"],"pet_size": ["toy", "small", "medium", "large", "giant"],"pet_species": ["dog", "cat", "other"],"photo_kind": ["before", "after"],"plan_tier": ["starter", "growth", "pro"],"price_rule_kind": ["size", "breed", "coat_condition"]
          }
        }
} as const
