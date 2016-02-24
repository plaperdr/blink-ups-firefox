$( document ).ready(function() {

    $('#check').change(function() {
        if(this.checked) {
            activateTorProxy();
        } else {
            deactivateTorProxy();
        }
    });

    $('#refreshFingerprint').click(function() {
        self.port.emit("refreshFingerprint");
    });

    $('#viewFingerprint').click(function() {
        self.port.emit("viewFingerprint");
    });

    if(self.options.proxy){
        $('#check').click();
    }


    //Management of Tor proxy
    function activateTorProxy(){
        //Sending action to index page
        self.port.emit("activateTorProxy");
    }

    function deactivateTorProxy(){
        //Sending action to index page
        self.port.emit("deactivateTorProxy");

        $('#connected').prop('checked',false);
    }

    self.port.on("verifyTor", function(){
        $('#loader').fadeIn(500);
        $('#connDiv').fadeIn(500);
        setTimeout(function() {
            $.ajax({
                url: "https://antani.tor2web.org/checktor",
                type: 'GET',
                dataType: 'json',
                success: function (data) {
                    if (data.IsTor) {
                        $('#connected').prop('checked', true);
                        $('#connDiv').delay(2000).fadeOut(500);
                        self.port.emit("connected");
                    }
                    $('#loader').hide();
                    $('#error').hide();

                },
                error: function () {
                    $('#loader').hide();
                    $('#error').show();
                    $('#check').click();
                }
            });
        }, 1000);
    });
});