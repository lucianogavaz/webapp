import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack {
            Text("Medical Image Viewer")
                .font(.largeTitle)
                .padding()
            Text("Pronto para carregar arquivos DICOM.")
                .font(.subheadline)
        }
        .frame(minWidth: 480, minHeight: 320)
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
