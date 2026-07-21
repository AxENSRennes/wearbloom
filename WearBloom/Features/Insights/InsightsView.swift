import Charts
import SwiftData
import SwiftUI

struct InsightsView: View {
    @Environment(AppSession.self) private var session
    @Query(sort: \Garment.wearCount, order: .reverse) private var garments: [Garment]
    @Query(sort: \WearEvent.date, order: .reverse) private var events: [WearEvent]

    private var activeGarments: [Garment] { garments.filter { !$0.isArchived } }
    private var recentEvents: [WearEvent] {
        let cutoff = Calendar.current.date(byAdding: .day, value: -30, to: .now) ?? .distantPast
        return events.filter { !$0.isPlanned && $0.date >= cutoff }
    }
    private var recentlyWornIDs: Set<UUID> {
        Set(recentEvents.flatMap { event in
            let pieces = event.garments.isEmpty ? (event.look?.garments ?? []) : event.garments
            return pieces.map(\.id)
        })
    }
    private var wornGarments: [Garment] { activeGarments.filter { recentlyWornIDs.contains($0.id) } }
    private var rotation: Int {
        guard !activeGarments.isEmpty else { return 0 }
        return Int((Double(wornGarments.count) / Double(activeGarments.count) * 100).rounded())
    }
    private var totalWears: Int { activeGarments.reduce(0) { $0 + $1.wearCount } }

    var body: some View {
        ZStack {
            BloomPageBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    BloomHeader(title: "Insights", subtitle: "Better use, not more stuff") {
                        session.isProfilePresented = true
                    }
                    impactHero
                    statRow
                    categoryChart
                    mostWorn
                    rediscovery
                    principleCard
                }
                .padding(.horizontal, 18)
                .padding(.top, 12)
                .padding(.bottom, 150)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .onAppear { Telemetry.event("screen_viewed", properties: ["screen": "insights"]) }
    }

    private var impactHero: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("LAST 30 DAYS")
                .font(.system(size: 12, weight: .black))
            HStack(alignment: .lastTextBaseline, spacing: 6) {
                Text("\(rotation)%")
                    .font(.system(size: 52, weight: .black, design: .rounded))
                    .tracking(-3)
                Text("in rotation")
                    .font(.system(size: 18, weight: .bold))
            }
            ProgressView(value: Double(rotation), total: 100)
                .tint(BloomColor.blue)
                .scaleEffect(x: 1, y: 2.2)
            Text("\(wornGarments.count) of \(activeGarments.count) pieces worn. " + (rotation >= 60 ? "Your closet is working hard." : "There is more to rediscover."))
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(BloomColor.ink.opacity(0.76))
        }
        .padding(20)
        .background(BloomColor.lime, in: RoundedRectangle(cornerRadius: 30))
        .overlay(RoundedRectangle(cornerRadius: 30).stroke(BloomColor.ink, lineWidth: 2))
    }

    private var statRow: some View {
        HStack(spacing: 12) {
            stat(value: "\(totalWears)", label: "wears", color: BloomColor.blue, foreground: .white)
            stat(value: "\(events.filter { !$0.isPlanned }.count)", label: "logged looks", color: BloomColor.paper, foreground: BloomColor.ink)
            stat(value: "\(activeGarments.count - wornGarments.count)", label: "to rediscover", color: BloomColor.coral, foreground: BloomColor.ink)
        }
    }

    private func stat(value: String, label: String, color: Color, foreground: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value).font(.system(size: 28, weight: .black, design: .rounded))
            Text(label).font(.system(size: 11, weight: .bold)).lineLimit(2)
        }
        .foregroundStyle(foreground)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .frame(height: 102)
        .background(color, in: RoundedRectangle(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(BloomColor.ink, lineWidth: 1.5))
    }

    private var categoryChart: some View {
        VStack(alignment: .leading, spacing: 14) {
            BloomSectionTitle(title: "Closet mix", detail: "By category")
            Chart(GarmentCategory.allCases) { category in
                let count = activeGarments.filter { $0.category == category }.count
                BarMark(
                    x: .value("Pieces", count),
                    y: .value("Category", category.title)
                )
                .foregroundStyle(category == .top ? BloomColor.blue : category == .bottom ? BloomColor.coral : BloomColor.lime)
                .cornerRadius(7)
                .annotation(position: .trailing) {
                    Text("\(count)").font(.caption2.weight(.bold))
                }
            }
            .chartXAxis(.hidden)
            .chartLegend(.hidden)
            .frame(height: 155)
        }
        .padding(18)
        .background(BloomColor.paper.opacity(0.94), in: RoundedRectangle(cornerRadius: 28))
        .overlay(RoundedRectangle(cornerRadius: 28).stroke(BloomColor.ink, lineWidth: 1.5))
    }

    private var mostWorn: some View {
        VStack(alignment: .leading, spacing: 13) {
            BloomSectionTitle(title: "Most worn", detail: "All time")
            ScrollView(.horizontal) {
                HStack(spacing: 12) {
                    ForEach(activeGarments.prefix(5)) { garment in
                        VStack(alignment: .leading, spacing: 8) {
                            ImageDataView(data: garment.imageData, fallback: garment.category.symbol)
                                .frame(width: 142, height: 180)
                                .clipped()
                                .clipShape(RoundedRectangle(cornerRadius: 23))
                            Text(garment.name)
                                .font(.system(size: 14, weight: .bold))
                                .lineLimit(1)
                            Label("\(garment.wearCount) wears", systemImage: "arrow.triangle.2.circlepath")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(BloomColor.blue)
                        }
                        .frame(width: 142, alignment: .leading)
                    }
                }
            }
            .scrollIndicators(.hidden)
        }
    }

    private var rediscovery: some View {
        VStack(alignment: .leading, spacing: 13) {
            BloomSectionTitle(title: "Rediscover", detail: "Wear next")
            ForEach(activeGarments.filter { $0.wearCount == 0 }.prefix(3)) { garment in
                HStack(spacing: 12) {
                    ImageDataView(data: garment.imageData, contentMode: .fit, fallback: garment.category.symbol)
                        .frame(width: 62, height: 72)
                        .background(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                    VStack(alignment: .leading, spacing: 3) {
                        Text(garment.name).font(.system(size: 15, weight: .black))
                        Text("Ready for a new combination").font(.caption).foregroundStyle(BloomColor.muted)
                    }
                    Spacer()
                    Button { session.select(garment); session.selectedTab = 1 } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 15, weight: .black))
                            .frame(width: 38, height: 38)
                            .background(BloomColor.lime, in: Circle())
                            .overlay(Circle().stroke(BloomColor.ink, lineWidth: 1.2))
                    }
                    .foregroundStyle(BloomColor.ink)
                }
            }
        }
    }

    private var principleCard: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "leaf.fill").foregroundStyle(BloomColor.lime)
            VStack(alignment: .leading, spacing: 4) {
                Text("No shop. No affiliate links.").font(.system(size: 15, weight: .black))
                Text("WearBloom helps you get more joy and use from the clothes you already own.")
                    .font(.system(size: 13)).foregroundStyle(.white.opacity(0.72))
            }
        }
        .foregroundStyle(.white)
        .padding(18)
        .background(BloomColor.ink, in: RoundedRectangle(cornerRadius: 26))
    }
}
