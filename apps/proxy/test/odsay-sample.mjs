/**
 * Minimal realistic ODsay `searchPubTransPathT` payload (shape only, values
 * illustrative) used by normalize-odsay.test.mjs.
 */
export const ODsaySubwaySample = {
  result: {
    path: [
      {
        info: {
          totalTime: 1300,
          pathType: 0,
          firstStartStation: { subwayStationName: '을지로입구' },
          lastEndStation: { subwayStationName: '강남역' },
        },
        subPath: [
          { trafficType: 4, sectionTime: 300, distance: 420, startName: '출발지' },
          {
            trafficType: 1,
            sectionTime: 720,
            distance: 8200,
            startName: '을지로입구',
            endName: '강남역',
            lane: [{ name: '2호선' }],
            passStopList: {
              stations: [
                { x: 126.9829, y: 37.5663 },
                { x: 127.0276, y: 37.498 },
              ],
            },
          },
          { trafficType: 4, sectionTime: 300, distance: 400, startName: '강남역' },
        ],
      },
      {
        info: {
          totalTime: 1780,
          pathType: 2,
        },
        subPath: [
          { trafficType: 4, sectionTime: 240, distance: 330, startName: '출발지' },
          {
            trafficType: 2,
            sectionTime: 900,
            distance: 5200,
            startName: '버스 타는 곳',
            endName: '신논현역',
            lane: [{ name: '143' }],
          },
          { trafficType: 3, sectionTime: 180, distance: 240, startName: '신논현역', endName: '강남구청 앞' },
          {
            trafficType: 2,
            sectionTime: 600,
            distance: 3600,
            startName: '강남구청 앞',
            endName: '강남역',
            lane: [{ name: '463' }],
          },
          { trafficType: 4, sectionTime: 120, distance: 150, startName: '강남역' },
        ],
      },
    ],
  },
};