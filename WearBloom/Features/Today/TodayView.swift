import SwiftData
import SwiftUI

struct TodayView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \WearEvent.date, order: .reverse) private var events: [WearEvent]
    @Query(sort: \Look.updatedAt, order: .reverse) private var looks: [Look]
    @Query(sort: \Garment.createdAt, order: .reverse) private var garments: [Garment]
    @State private var selectedDate = Date.now
    @State private var isPlannerPresented = false

    private var calendar: Calendar { .current }
    private var week: [Date] {
        guard let interval = calendar.dateInterval(of: .weekOfYear, for: .now) else { return [.now] }
        return (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: interval.start) }
    }
    private var selectedEvent: WearEvent? {
        events.first { calendar.isDate($0.date, inSameDayAs: selectedDate) }
    }
    private var selectedGarments: [Garment] {
        garments.filter { session.selectedGarmentIDs.values.contains($0.id) }
    }

    var body: some View {
        ZStack {
            BloomPageBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    BloomHeader(title: "Today", subtitle: "Wear more. Remember every look.") {
                        session.isProfilePresented = true
                    }
                    weekStrip
                    dayCard
                    rotationPrompt
                    recentTimeline
                }
                .padding(.horizontal, 18)
                .padding(.top, 12)
                .padding(.bottom, 150)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $isPlannerPresented) {
            LookPlannerSheet(date: selectedDate)
        }
        .onAppear { Telemetry.event("screen_viewed", properties: ["screen": "today"]) }
    }

    private var weekStrip: some View {
        HStack(spacing: 7) {
            ForEach(week, id: \.self) { date in
                let selected = calendar.isDate(date, inSameDayAs: selectedDate)
                let hasLook = events.contains { calendar.isDate($0.date, inSameDayAs: date) }
                Button {
                    withAnimation(.snappy) { selectedDate = date }
                } label: {
                    VStack(spacing: 6) {
                        Text(date.formatted(.dateTime.weekday(.narrow)))
                            .font(.system(size: 11, weight: .bold))
                        Text(date.formatted(.dateTime.day()))
                            .font(.system(size: 17, weight: .black, design: .rounded))
                        Circle()
                            .fill(hasLook ? BloomColor.lime : .clear)
                            .frame(width: 5, height: 5)
                    }
                    .foregroundStyle(selected ? .white : BloomColor.ink)
                    .frame(maxWidth: .infinity)
                    .frame(height: 75)
                    .background(selected ? BloomColor.blue : BloomColor.paper, in: Capsule())
                    .overlay(Capsule().stroke(BloomColor.ink, lineWidth: selected ? 0 : 1.2))
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder private var dayCard: some View {
        if let event = selectedEvent {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(event.isPlanned ? "Planned outfit" : "What you wore")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(BloomColor.blue)
                        Text(event.look?.name ?? "Closet combination")
                            .font(.system(size: 23, weight: .black, design: .rounded))
                    }
                    Spacer()
                    if event.isPlanned {
                        Button("Wore it") { markWorn(event) }
                            .font(.system(size: 13, weight: .black))
                            .padding(.horizontal, 14)
                            .frame(height: 38)
                            .background(BloomColor.lime, in: Capsule())
                            .overlay(Capsule().stroke(BloomColor.ink, lineWidth: 1.3))
                    }
                }
                if pieces(for: event).isEmpty {
                    Label("Outfit unavailable", systemImage: "exclamationmark.triangle")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(BloomColor.muted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 12)
                } else {
                    HStack(spacing: -8) {
                        ForEach(pieces(for: event).prefix(4)) { garment in
                            ImageDataView(data: garment.imageData, contentMode: .fit, fallback: garment.category.symbol)
                                .frame(maxWidth: .infinity)
                                .frame(height: 180)
                                .background(.white, in: RoundedRectangle(cornerRadius: 22))
                                .overlay(RoundedRectangle(cornerRadius: 22).stroke(BloomColor.ink, lineWidth: 1.2))
                                .rotationEffect(.degrees(garment.id.hashValue.isMultiple(of: 2) ? -2 : 2))
                        }
                    }
                }
            }
            .padding(18)
            .background(BloomColor.paper.opacity(0.94), in: RoundedRectangle(cornerRadius: 30))
            .overlay(RoundedRectangle(cornerRadius: 30).stroke(BloomColor.ink, lineWidth: 2))
        } else {
            VStack(alignment: .leading, spacing: 14) {
                Text(calendar.isDateInToday(selectedDate) ? "What are you wearing today?" : "Plan this day")
                    .font(.system(size: 25, weight: .black, design: .rounded))
                Text("Turn your saved looks into a useful wardrobe memory — no shopping required.")
                    .font(.system(size: 15))
                    .foregroundStyle(BloomColor.muted)
                HStack(spacing: 10) {
                    Button("Choose a look", systemImage: "calendar.badge.plus") { isPlannerPresented = true }
                        .buttonStyle(BloomButtonStyle(fill: BloomColor.lime))
                    if !selectedGarments.isEmpty {
                        Button { recordCurrentSelection() } label: {
                            Image(systemName: "checkmark")
                                .font(.system(size: 17, weight: .black))
                                .frame(width: 54, height: 54)
                        }
                        .foregroundStyle(.white)
                        .background(BloomColor.blue, in: Circle())
                    }
                }
            }
            .padding(20)
            .background(BloomColor.paper.opacity(0.94), in: RoundedRectangle(cornerRadius: 30))
            .overlay(RoundedRectangle(cornerRadius: 30).stroke(BloomColor.ink, lineWidth: 2))
        }
    }

    private var rotationPrompt: some View {
        Button {
            session.selectedTab = 1
        } label: {
            HStack(spacing: 14) {
                Image(systemName: "arrow.triangle.2.circlepath")
                    .font(.system(size: 24, weight: .black))
                    .frame(width: 54, height: 54)
                    .background(BloomColor.coral, in: Circle())
                VStack(alignment: .leading, spacing: 3) {
                    Text("Remix what you own")
                        .font(.system(size: 17, weight: .black))
                    Text("A fresh mix from the pieces you wear least")
                        .font(.system(size: 13))
                        .foregroundStyle(BloomColor.muted)
                }
                Spacer()
                Image(systemName: "arrow.right")
            }
            .foregroundStyle(BloomColor.ink)
            .padding(16)
            .background(BloomColor.lime, in: RoundedRectangle(cornerRadius: 26))
            .overlay(RoundedRectangle(cornerRadius: 26).stroke(BloomColor.ink, lineWidth: 2))
        }
        .buttonStyle(.plain)
    }

    private var recentTimeline: some View {
        VStack(alignment: .leading, spacing: 13) {
            BloomSectionTitle(title: "Recently worn", detail: "Your history")
            if events.filter({ !$0.isPlanned }).isEmpty {
                Text("Log your first outfit to start seeing your rotation.")
                    .font(.system(size: 14))
                    .foregroundStyle(BloomColor.muted)
                    .padding(.vertical, 14)
            } else {
                ForEach(events.filter { !$0.isPlanned }.prefix(4)) { event in
                    HStack(spacing: 12) {
                        Text(event.date.formatted(.dateTime.day().month(.abbreviated)))
                            .font(.system(size: 13, weight: .black))
                            .frame(width: 48)
                        HStack(spacing: -5) {
                            ForEach(pieces(for: event).prefix(3)) { garment in
                                ImageDataView(data: garment.imageData, contentMode: .fit, fallback: garment.category.symbol)
                                    .frame(width: 44, height: 52)
                                    .background(.white)
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                            }
                        }
                        Text(event.look?.name ?? "Closet combination")
                            .font(.system(size: 14, weight: .bold))
                        Spacer()
                    }
                }
            }
        }
    }

    private func recordCurrentSelection() {
        let event = WearEvent(date: selectedDate, garments: selectedGarments)
        modelContext.insert(event)
        applyWear(to: selectedGarments)
        try? modelContext.save()
        Telemetry.event("wear_logged", properties: ["piece_count": selectedGarments.count, "source": "current_selection"])
    }

    private func markWorn(_ event: WearEvent) {
        event.isPlanned = false
        applyWear(to: event.garments)
        if let look = event.look {
            look.wearCount += 1
            look.lastWornAt = event.date
        }
        try? modelContext.save()
        Telemetry.event("planned_look_worn", properties: ["piece_count": event.garments.count])
    }

    private func applyWear(to pieces: [Garment]) {
        for garment in pieces {
            garment.wearCount += 1
            garment.lastWornAt = selectedDate
        }
    }

    private func pieces(for event: WearEvent) -> [Garment] {
        event.garments.isEmpty ? (event.look?.garments ?? []) : event.garments
    }
}

private struct LookPlannerSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Look.updatedAt, order: .reverse) private var looks: [Look]
    let date: Date

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 18) {
                    ForEach(looks) { look in
                        Button { plan(look) } label: {
                            VStack(alignment: .leading, spacing: 8) {
                                ZStack {
                                    BloomColor.softBlue
                                    HStack(spacing: -12) {
                                        ForEach(look.garments.prefix(3)) { garment in
                                            ImageDataView(data: garment.imageData, contentMode: .fit, fallback: garment.category.symbol)
                                                .frame(width: 74, height: 115)
                                        }
                                    }
                                }
                                .frame(height: 190)
                                .clipShape(RoundedRectangle(cornerRadius: 24))
                                Text(look.name)
                                    .font(.system(size: 15, weight: .black))
                                    .foregroundStyle(BloomColor.ink)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(18)
            }
            .background(BloomColor.cream)
            .navigationTitle("Choose a look")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }

    private func plan(_ look: Look) {
        let event = WearEvent(date: date, isPlanned: true, look: look, garments: look.garments)
        look.plannedDate = date
        modelContext.insert(event)
        try? modelContext.save()
        Telemetry.event("look_planned", properties: ["piece_count": look.garments.count])
        dismiss()
    }
}
