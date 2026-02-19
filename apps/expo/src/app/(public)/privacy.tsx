import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";

import { ThemedText } from "@acme/ui";

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View className="gap-2">
      <ThemedText variant="heading">{title}</ThemedText>
      <ThemedText variant="body" className="text-text-secondary">
        {children}
      </ThemedText>
    </View>
  );
}

export default function PrivacyScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "",
          headerShadowVisible: false,
          headerBackTitle: "Back",
        }}
      />
      <ScrollView
        className="flex-1 px-4"
        contentContainerClassName="gap-6 pb-8 pt-4"
      >
        <View className="gap-1">
          <ThemedText variant="display">Privacy Policy</ThemedText>
          <ThemedText variant="caption" className="text-text-secondary">
            Last updated: February 15, 2026
          </ThemedText>
        </View>

        <ThemedText variant="body" className="text-text-secondary">
          Wearbloom ("we", "our", or "us") is committed to protecting your
          privacy. This Privacy Policy explains how we collect, use, store, and
          protect your personal information when you use our mobile application.
        </ThemedText>

        <Section title="Data We Collect">
          {`We collect the following types of data to provide our AI virtual try-on service:\n\n\u2022 Photos: Body avatar photos you upload for virtual try-on rendering.\n\u2022 Wardrobe data: Garment photos you add to your virtual wardrobe.\n\u2022 Account information: Email address and display name when you create an account.\n\u2022 Usage data: App interaction metrics to improve our service.\n\u2022 Subscription data: Purchase history for managing your subscription.`}
        </Section>

        <Section title="How We Use Your Data">
          {`Your data is used exclusively for the following purposes:\n\n\u2022 AI try-on rendering: Your photos and garment images are processed by our AI inference service to generate virtual try-on results.\n\u2022 Personalization: Wardrobe data is stored so you can browse and re-use your garments.\n\u2022 Service improvement: Aggregated, anonymized usage metrics help us improve the app experience.\n\u2022 Account management: Email is used for authentication and account recovery.`}
        </Section>

        <Section title="Data Storage & Security">
          {`We take security seriously:\n\n\u2022 All photos are stored on secure servers with restricted access.\n\u2022 All data transfers between your device and our servers are encrypted via HTTPS.\n\u2022 Authentication tokens are stored in your device's secure enclave (iOS Keychain).\n\u2022 We do not sell, rent, or share your personal data with third parties for marketing purposes.`}
        </Section>

        <Section title="Third-Party Services">
          {`We use the following third-party services to operate Wearbloom:\n\n\u2022 AI try-on providers (FASHN AI and Google): Process your photos for virtual try-on rendering. Photos are transmitted securely via HTTPS and are not retained by the providers after processing.\n\u2022 Background removal (Bria AI): Removes the background from garment photos you upload. Images are transmitted securely and are not retained after processing.\n\u2022 Apple In-App Purchases: Handles subscription payments. Apple processes payment information directly; we do not store your payment details.`}
        </Section>

        <Section title="Your Rights">
          {`You have the following rights regarding your data:\n\n\u2022 Access: You can view all data associated with your account within the app.\n\u2022 Deletion: You can delete your entire account and all associated data (photos, wardrobe, renders, usage history) at any time from the Profile screen. Deletion is permanent and irreversible.\n\u2022 Portability: You may request a copy of your data by contacting us.\n\u2022 Withdrawal of consent: You may stop using the app at any time. Uninstalling the app removes local data from your device.`}
        </Section>

        <Section title="Contact Information">
          {`For any questions about this Privacy Policy or your data, please contact us:\n\n\u2022 Email: privacy@wearbloom.app\n\u2022 Website: https://wearbloom.app/privacy`}
        </Section>

        <Section title="Data Deletion">
          {`You can request full deletion of your account and all associated data at any time through the Profile screen in the app. Upon deletion, we permanently remove:\n\n\u2022 Your account and profile information\n\u2022 All uploaded photos (body avatar and garments)\n\u2022 All virtual try-on renders\n\u2022 Your usage history and subscription records\n\nDeletion is processed immediately and cannot be reversed.`}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
